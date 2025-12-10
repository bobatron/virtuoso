# Sprint 3: Conductor CLI Mode (2 weeks)

## 🎯 Sprint Goal

Implement headless CLI mode for running Performances without the GUI, enabling CI/CD integration and automated testing workflows.

## 📋 Success Criteria

- [ ] Can run Performances from command line
- [ ] Supports accounts.json for credentials
- [ ] Supports environment variables for credentials
- [ ] Supports command-line arguments for credentials
- [ ] Console output formatter (human-readable)
- [ ] JSON output formatter (machine-readable)
- [ ] JUnit XML output formatter (CI integration)
- [ ] Exit codes indicate pass/fail
- [ ] Works in CI environments (GitHub Actions, etc.)

## 📦 Prerequisites

- Sprint 2 completed
- Cue and assertion execution working
- Performance store implemented

---

## 🔨 Work Items

### 1. Create CLI Entry Point
**Priority:** 🔴 CRITICAL  
**Estimate:** 4-5 hours

**Description:**  
Create a separate CLI entry point that can be invoked via `npx virtuoso` or direct execution.

**Tasks:**
- [ ] Create `src/cli/conductor.ts` entry point
- [ ] Parse command-line arguments
- [ ] Load and validate Performance file
- [ ] Initialize XMPP connections without GUI
- [ ] Handle graceful shutdown

**New File - `src/cli/conductor.ts`:**
```typescript
#!/usr/bin/env node

import { Command } from 'commander';
import { existsSync, readFileSync } from 'fs';
import { resolve, basename } from 'path';
import type { Performance } from '../types/performance';
import { PerformanceRunner } from '../main/performanceRunner';
import { AccountManager } from './accountManager';
import { ConsoleFormatter } from './formatters/console';
import { JsonFormatter } from './formatters/json';
import { JUnitFormatter } from './formatters/junit';
import type { OutputFormatter } from './formatters/types';

const VERSION = '0.1.0';

async function main(): Promise<void> {
  const program = new Command();

  program
    .name('virtuoso')
    .description('Run Virtuoso Performances from the command line')
    .version(VERSION);

  program
    .command('run')
    .description('Run a Performance file')
    .argument('<performance>', 'Path to Performance file (.json or .performance.json)')
    .option('-a, --accounts <file>', 'Path to accounts.json file')
    .option('-f, --format <format>', 'Output format: console, json, junit', 'console')
    .option('-o, --output <file>', 'Output file (default: stdout)')
    .option('-t, --timeout <ms>', 'Default timeout for Cues in ms', '10000')
    .option('--env-prefix <prefix>', 'Environment variable prefix for accounts', 'VIRTUOSO')
    .option('-v, --verbose', 'Verbose output')
    .option('--fail-fast', 'Stop on first failure')
    .action(async (performancePath: string, options) => {
      const exitCode = await runPerformance(performancePath, options);
      process.exit(exitCode);
    });

  program
    .command('validate')
    .description('Validate a Performance file without running')
    .argument('<performance>', 'Path to Performance file')
    .action(async (performancePath: string) => {
      const exitCode = await validatePerformance(performancePath);
      process.exit(exitCode);
    });

  program
    .command('list-accounts')
    .description('List accounts from accounts.json or environment')
    .option('-a, --accounts <file>', 'Path to accounts.json file')
    .option('--env-prefix <prefix>', 'Environment variable prefix', 'VIRTUOSO')
    .action(async (options) => {
      await listAccounts(options);
    });

  await program.parseAsync(process.argv);
}

async function runPerformance(
  performancePath: string,
  options: {
    accounts?: string;
    format: string;
    output?: string;
    timeout: string;
    envPrefix: string;
    verbose?: boolean;
    failFast?: boolean;
  }
): Promise<number> {
  // Load Performance file
  const absolutePath = resolve(performancePath);
  
  if (!existsSync(absolutePath)) {
    console.error(`Error: Performance file not found: ${absolutePath}`);
    return 2;
  }

  let performance: Performance;
  try {
    const content = readFileSync(absolutePath, 'utf-8');
    performance = JSON.parse(content);
  } catch (error) {
    console.error(`Error: Failed to parse Performance file: ${error}`);
    return 2;
  }

  // Initialize formatter
  const formatter = getFormatter(options.format, options.output);

  // Load accounts
  const accountManager = new AccountManager(options.accounts, options.envPrefix);
  
  try {
    await accountManager.load();
  } catch (error) {
    console.error(`Error: Failed to load accounts: ${error}`);
    return 2;
  }

  // Validate required accounts exist
  const requiredAccounts = extractRequiredAccounts(performance);
  const missingAccounts = requiredAccounts.filter(
    alias => !accountManager.hasAccount(alias)
  );

  if (missingAccounts.length > 0) {
    console.error(`Error: Missing accounts: ${missingAccounts.join(', ')}`);
    console.error('Provide accounts via --accounts file or environment variables');
    return 2;
  }

  // Start output
  formatter.start(performance);

  // Run performance
  const runner = new PerformanceRunner({
    performance,
    accountManager,
    timeout: parseInt(options.timeout, 10),
    failFast: options.failFast,
    onStanzaStart: (stanza) => {
      formatter.stanzaStart(stanza);
    },
    onStanzaComplete: (stanza, result) => {
      formatter.stanzaComplete(stanza, result);
    },
    onLog: options.verbose ? (msg) => console.log(`  ${msg}`) : undefined,
  });

  try {
    const result = await runner.run();
    
    // Output results
    formatter.complete(result);
    formatter.flush();

    // Return appropriate exit code
    return result.status === 'passed' ? 0 : 1;
  } catch (error) {
    console.error(`Error: Performance failed: ${error}`);
    return 2;
  } finally {
    // Cleanup connections
    await accountManager.disconnectAll();
  }
}

async function validatePerformance(performancePath: string): Promise<number> {
  const absolutePath = resolve(performancePath);
  
  if (!existsSync(absolutePath)) {
    console.error(`Error: File not found: ${absolutePath}`);
    return 2;
  }

  try {
    const content = readFileSync(absolutePath, 'utf-8');
    const performance = JSON.parse(content);

    // Basic validation
    if (!performance.name) {
      console.error('Validation error: Missing "name" field');
      return 1;
    }

    if (!Array.isArray(performance.stanzas)) {
      console.error('Validation error: Missing or invalid "stanzas" array');
      return 1;
    }

    console.log(`✓ Valid Performance: ${performance.name}`);
    console.log(`  Stanzas: ${performance.stanzas.length}`);
    
    return 0;
  } catch (error) {
    console.error(`Validation error: ${error}`);
    return 1;
  }
}

async function listAccounts(options: {
  accounts?: string;
  envPrefix: string;
}): Promise<void> {
  const accountManager = new AccountManager(options.accounts, options.envPrefix);
  
  try {
    await accountManager.load();
    const accounts = accountManager.getAccounts();

    if (accounts.length === 0) {
      console.log('No accounts found');
      return;
    }

    console.log('Available accounts:');
    accounts.forEach(acc => {
      console.log(`  ${acc.alias}: ${acc.jid} (${acc.source})`);
    });
  } catch (error) {
    console.error(`Error: ${error}`);
  }
}

function extractRequiredAccounts(performance: Performance): string[] {
  const aliases = new Set<string>();
  
  performance.stanzas.forEach(stanza => {
    if (stanza.account) {
      aliases.add(stanza.account);
    }
  });

  return Array.from(aliases);
}

function getFormatter(format: string, output?: string): OutputFormatter {
  switch (format) {
    case 'json':
      return new JsonFormatter(output);
    case 'junit':
      return new JUnitFormatter(output);
    case 'console':
    default:
      return new ConsoleFormatter();
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(2);
});
```

**Update package.json:**
```json
{
  "bin": {
    "virtuoso": "./dist/cli/conductor.js"
  }
}
```

**Install dependencies:**
```bash
npm install commander
npm install -D @types/node
```

**Verification:**
- `npx virtuoso run test.json` parses arguments
- Missing file shows error
- Invalid JSON shows error
- Help text shows all options

---

### 2. Implement Account Manager for CLI
**Priority:** 🔴 CRITICAL  
**Estimate:** 4-5 hours

**Description:**  
Manage account credentials from multiple sources: JSON file, environment variables, or CLI arguments.

**Tasks:**
- [ ] Create `src/cli/accountManager.ts`
- [ ] Load accounts from accounts.json
- [ ] Load accounts from environment variables
- [ ] Support CLI argument credentials
- [ ] Connect to XMPP servers

**New File - `src/cli/accountManager.ts`:**
```typescript
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { client, xml } from '@xmpp/client';
import type { XmppClient } from '@xmpp/client';

export interface AccountConfig {
  alias: string;
  jid: string;
  password: string;
  host?: string;
  port?: number;
  source: 'file' | 'env' | 'cli';
}

export interface ConnectedAccount {
  config: AccountConfig;
  client: XmppClient;
}

export class AccountManager {
  private accountsFile?: string;
  private envPrefix: string;
  private accounts: Map<string, AccountConfig> = new Map();
  private connections: Map<string, ConnectedAccount> = new Map();

  constructor(accountsFile?: string, envPrefix: string = 'VIRTUOSO') {
    this.accountsFile = accountsFile;
    this.envPrefix = envPrefix;
  }

  /**
   * Load accounts from all sources
   */
  async load(): Promise<void> {
    // Priority: CLI > Environment > File
    // Load file accounts first (lowest priority)
    await this.loadFromFile();
    
    // Load environment accounts (override file)
    this.loadFromEnvironment();
  }

  /**
   * Load accounts from accounts.json file
   */
  private async loadFromFile(): Promise<void> {
    let filePath = this.accountsFile;
    
    // Check default locations
    if (!filePath) {
      const defaultLocations = [
        'accounts.json',
        '.virtuoso/accounts.json',
        resolve(process.env.HOME || '', '.virtuoso/accounts.json'),
      ];
      
      for (const loc of defaultLocations) {
        if (existsSync(loc)) {
          filePath = loc;
          break;
        }
      }
    }

    if (!filePath || !existsSync(filePath)) {
      return; // No file found, not an error
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      if (data.accounts && Array.isArray(data.accounts)) {
        for (const acc of data.accounts) {
          this.accounts.set(acc.alias, {
            alias: acc.alias,
            jid: acc.jid,
            password: acc.password,
            host: acc.host,
            port: acc.port,
            source: 'file',
          });
        }
      }
    } catch (error) {
      throw new Error(`Failed to parse accounts file: ${error}`);
    }
  }

  /**
   * Load accounts from environment variables
   * 
   * Format: VIRTUOSO_ALICE_JID, VIRTUOSO_ALICE_PASSWORD
   * Or: VIRTUOSO_ACCOUNTS='[{"alias":"alice","jid":"...","password":"..."}]'
   */
  private loadFromEnvironment(): void {
    // Check for JSON array in env
    const accountsJson = process.env[`${this.envPrefix}_ACCOUNTS`];
    if (accountsJson) {
      try {
        const accounts = JSON.parse(accountsJson);
        for (const acc of accounts) {
          this.accounts.set(acc.alias, {
            ...acc,
            source: 'env',
          });
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Check for individual account env vars
    // Pattern: VIRTUOSO_<ALIAS>_JID, VIRTUOSO_<ALIAS>_PASSWORD
    const envKeys = Object.keys(process.env);
    const jidPattern = new RegExp(`^${this.envPrefix}_([A-Z0-9_]+)_JID$`, 'i');
    
    for (const key of envKeys) {
      const match = key.match(jidPattern);
      if (match) {
        const alias = match[1].toLowerCase();
        const jid = process.env[key];
        const passwordKey = `${this.envPrefix}_${match[1]}_PASSWORD`;
        const password = process.env[passwordKey];

        if (jid && password) {
          const hostKey = `${this.envPrefix}_${match[1]}_HOST`;
          const portKey = `${this.envPrefix}_${match[1]}_PORT`;

          this.accounts.set(alias, {
            alias,
            jid,
            password,
            host: process.env[hostKey],
            port: process.env[portKey] ? parseInt(process.env[portKey], 10) : undefined,
            source: 'env',
          });
        }
      }
    }
  }

  /**
   * Add account from CLI arguments
   */
  addCliAccount(alias: string, jid: string, password: string, host?: string): void {
    this.accounts.set(alias, {
      alias,
      jid,
      password,
      host,
      source: 'cli',
    });
  }

  /**
   * Check if an account exists
   */
  hasAccount(alias: string): boolean {
    return this.accounts.has(alias);
  }

  /**
   * Get all loaded accounts
   */
  getAccounts(): AccountConfig[] {
    return Array.from(this.accounts.values());
  }

  /**
   * Connect to an account's XMPP server
   */
  async connect(alias: string): Promise<ConnectedAccount> {
    // Check if already connected
    if (this.connections.has(alias)) {
      return this.connections.get(alias)!;
    }

    const config = this.accounts.get(alias);
    if (!config) {
      throw new Error(`Account not found: ${alias}`);
    }

    const xmpp = client({
      service: config.host 
        ? `xmpp://${config.host}:${config.port || 5222}`
        : `xmpp://${config.jid.split('@')[1]}:5222`,
      domain: config.jid.split('@')[1],
      username: config.jid.split('@')[0],
      password: config.password,
    });

    return new Promise((resolve, reject) => {
      xmpp.on('online', () => {
        const connected: ConnectedAccount = { config, client: xmpp };
        this.connections.set(alias, connected);
        resolve(connected);
      });

      xmpp.on('error', (err) => {
        reject(new Error(`Connection failed for ${alias}: ${err.message}`));
      });

      xmpp.start().catch(reject);
    });
  }

  /**
   * Get a connected client
   */
  getConnection(alias: string): ConnectedAccount | undefined {
    return this.connections.get(alias);
  }

  /**
   * Send XML stanza via an account
   */
  async send(alias: string, xmlString: string): Promise<void> {
    let connection = this.connections.get(alias);
    
    if (!connection) {
      connection = await this.connect(alias);
    }

    // Parse and send
    const stanza = xml.parse(xmlString);
    await connection.client.send(stanza);
  }

  /**
   * Disconnect all accounts
   */
  async disconnectAll(): Promise<void> {
    const disconnects = Array.from(this.connections.values()).map(
      async (conn) => {
        try {
          await conn.client.stop();
        } catch {
          // Ignore disconnect errors
        }
      }
    );

    await Promise.all(disconnects);
    this.connections.clear();
  }

  /**
   * Disconnect a specific account
   */
  async disconnect(alias: string): Promise<void> {
    const connection = this.connections.get(alias);
    if (connection) {
      try {
        await connection.client.stop();
      } catch {
        // Ignore
      }
      this.connections.delete(alias);
    }
  }
}
```

**accounts.json example:**
```json
{
  "accounts": [
    {
      "alias": "alice",
      "jid": "alice@example.com",
      "password": "secret123",
      "host": "xmpp.example.com",
      "port": 5222
    },
    {
      "alias": "bob",
      "jid": "bob@example.com",
      "password": "secret456"
    }
  ]
}
```

**Verification:**
- Loads accounts from accounts.json
- Loads accounts from VIRTUOSO_ALICE_JID, VIRTUOSO_ALICE_PASSWORD
- Environment overrides file
- Missing account shows clear error
- Connection works

---

### 3. Implement Console Output Formatter
**Priority:** 🔴 CRITICAL  
**Estimate:** 3-4 hours

**Description:**  
Human-readable console output for running Performances.

**Tasks:**
- [ ] Create `src/cli/formatters/types.ts` interface
- [ ] Create `src/cli/formatters/console.ts`
- [ ] Show progress indicators
- [ ] Color-code pass/fail
- [ ] Show summary

**New File - `src/cli/formatters/types.ts`:**
```typescript
import type { Performance, Stanza, StanzaResult, PlaybackResult } from '../../types/performance';

export interface OutputFormatter {
  /**
   * Called at the start of a Performance run
   */
  start(performance: Performance): void;

  /**
   * Called when a stanza starts executing
   */
  stanzaStart(stanza: Stanza): void;

  /**
   * Called when a stanza completes
   */
  stanzaComplete(stanza: Stanza, result: StanzaResult): void;

  /**
   * Called when the Performance run completes
   */
  complete(result: PlaybackResult): void;

  /**
   * Flush any buffered output
   */
  flush(): void;
}
```

**New File - `src/cli/formatters/console.ts`:**
```typescript
import type { Performance, Stanza, StanzaResult, PlaybackResult } from '../../types/performance';
import type { OutputFormatter } from './types';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

// Unicode symbols
const symbols = {
  pass: '✓',
  fail: '✗',
  pending: '○',
  running: '●',
  arrow: '→',
};

export class ConsoleFormatter implements OutputFormatter {
  private startTime: number = 0;
  private stanzaCount: number = 0;
  private currentStanza: number = 0;

  start(performance: Performance): void {
    this.startTime = Date.now();
    this.stanzaCount = performance.stanzas.length;
    this.currentStanza = 0;

    console.log();
    console.log(`${colors.bold}Virtuoso Performance: ${performance.name}${colors.reset}`);
    if (performance.description) {
      console.log(`${colors.dim}${performance.description}${colors.reset}`);
    }
    console.log();
  }

  stanzaStart(stanza: Stanza): void {
    this.currentStanza++;
    const progress = `[${this.currentStanza}/${this.stanzaCount}]`;
    const type = this.formatStanzaType(stanza.type);
    
    process.stdout.write(
      `  ${colors.dim}${progress}${colors.reset} ${type} ${stanza.description || ''} `
    );
  }

  stanzaComplete(stanza: Stanza, result: StanzaResult): void {
    if (result.status === 'passed') {
      console.log(`${colors.green}${symbols.pass}${colors.reset} ${colors.dim}${result.duration}ms${colors.reset}`);
    } else if (result.status === 'failed') {
      console.log(`${colors.red}${symbols.fail}${colors.reset}`);
      if (result.error) {
        console.log(`    ${colors.red}Error: ${result.error.message}${colors.reset}`);
      }
      if (result.assertionResults) {
        result.assertionResults.filter(a => !a.passed).forEach(a => {
          console.log(`    ${colors.red}Assertion failed: ${a.expected}${colors.reset}`);
          if (a.actual) {
            console.log(`    ${colors.dim}Actual: ${a.actual}${colors.reset}`);
          }
        });
      }
    } else {
      console.log(`${colors.yellow}skipped${colors.reset}`);
    }
  }

  complete(result: PlaybackResult): void {
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
    
    console.log();
    
    if (result.status === 'passed') {
      console.log(`${colors.green}${colors.bold}${symbols.pass} PASSED${colors.reset}`);
    } else {
      console.log(`${colors.red}${colors.bold}${symbols.fail} FAILED${colors.reset}`);
    }

    console.log();
    console.log(`  ${colors.dim}Duration:${colors.reset} ${duration}s`);
    console.log(`  ${colors.green}Passed:${colors.reset}  ${result.summary.passed}`);
    console.log(`  ${colors.red}Failed:${colors.reset}  ${result.summary.failed}`);
    if (result.summary.skipped > 0) {
      console.log(`  ${colors.yellow}Skipped:${colors.reset} ${result.summary.skipped}`);
    }
    console.log();
  }

  flush(): void {
    // Console output is immediate, nothing to flush
  }

  private formatStanzaType(type: string): string {
    switch (type) {
      case 'send':
        return `${colors.blue}SEND${colors.reset}`;
      case 'cue':
        return `${colors.yellow}CUE${colors.reset} `;
      case 'assert':
        return `${colors.green}ASSERT${colors.reset}`;
      default:
        return type.toUpperCase().padEnd(6);
    }
  }
}
```

**Sample Output:**
```
Virtuoso Performance: Login and Send Message
Test that users can log in and send messages

  [1/5] SEND   Login as Alice ✓ 245ms
  [2/5] CUE    Wait for login response ✓ 52ms
  [3/5] SEND   Send message to Bob ✓ 18ms
  [4/5] CUE    Wait for message delivery ✓ 103ms
  [5/5] ASSERT Check message received ✓ 2ms

✓ PASSED

  Duration: 0.42s
  Passed:  5
  Failed:  0
```

**Verification:**
- Shows progress as [n/total]
- Pass shows green checkmark
- Fail shows red X with error
- Summary shows totals
- Duration displays correctly

---

### 4. Implement JSON Output Formatter
**Priority:** 🔴 CRITICAL  
**Estimate:** 2-3 hours

**Description:**  
Machine-readable JSON output for programmatic consumption.

**Tasks:**
- [ ] Create `src/cli/formatters/json.ts`
- [ ] Buffer all output until complete
- [ ] Include full result details
- [ ] Support file output

**New File - `src/cli/formatters/json.ts`:**
```typescript
import { writeFileSync } from 'fs';
import type { Performance, Stanza, StanzaResult, PlaybackResult } from '../../types/performance';
import type { OutputFormatter } from './types';

interface JsonOutput {
  performance: {
    name: string;
    description?: string;
  };
  timestamp: string;
  duration: number;
  status: 'passed' | 'failed' | 'error';
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  stanzas: Array<{
    id: string;
    type: string;
    description?: string;
    status: string;
    duration: number;
    error?: {
      message: string;
      code?: string;
    };
    assertions?: Array<{
      id: string;
      passed: boolean;
      expected?: string;
      actual?: string;
    }>;
  }>;
}

export class JsonFormatter implements OutputFormatter {
  private outputFile?: string;
  private performance?: Performance;
  private stanzaResults: Array<{
    stanza: Stanza;
    result: StanzaResult;
  }> = [];
  private startTime: number = 0;

  constructor(outputFile?: string) {
    this.outputFile = outputFile;
  }

  start(performance: Performance): void {
    this.performance = performance;
    this.stanzaResults = [];
    this.startTime = Date.now();
  }

  stanzaStart(_stanza: Stanza): void {
    // JSON formatter buffers everything
  }

  stanzaComplete(stanza: Stanza, result: StanzaResult): void {
    this.stanzaResults.push({ stanza, result });
  }

  complete(result: PlaybackResult): void {
    const output: JsonOutput = {
      performance: {
        name: this.performance!.name,
        description: this.performance!.description,
      },
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      status: result.status,
      summary: result.summary,
      stanzas: this.stanzaResults.map(({ stanza, result }) => ({
        id: stanza.id,
        type: stanza.type,
        description: stanza.description,
        status: result.status,
        duration: result.duration,
        error: result.error,
        assertions: result.assertionResults?.map(a => ({
          id: a.assertionId,
          passed: a.passed,
          expected: a.expected,
          actual: a.actual,
        })),
      })),
    };

    const json = JSON.stringify(output, null, 2);

    if (this.outputFile) {
      writeFileSync(this.outputFile, json, 'utf-8');
    } else {
      console.log(json);
    }
  }

  flush(): void {
    // Output happens in complete()
  }
}
```

**Verification:**
- Valid JSON output
- Includes all stanza results
- Writes to file if specified
- Outputs to stdout if no file

---

### 5. Implement JUnit XML Output Formatter
**Priority:** 🟡 HIGH  
**Estimate:** 3-4 hours

**Description:**  
JUnit XML format for CI/CD integration (GitHub Actions, Jenkins, etc.).

**Tasks:**
- [ ] Create `src/cli/formatters/junit.ts`
- [ ] Generate valid JUnit XML
- [ ] Map stanzas to test cases
- [ ] Include failure messages

**New File - `src/cli/formatters/junit.ts`:**
```typescript
import { writeFileSync } from 'fs';
import type { Performance, Stanza, StanzaResult, PlaybackResult } from '../../types/performance';
import type { OutputFormatter } from './types';

export class JUnitFormatter implements OutputFormatter {
  private outputFile?: string;
  private performance?: Performance;
  private stanzaResults: Array<{
    stanza: Stanza;
    result: StanzaResult;
  }> = [];
  private startTime: number = 0;

  constructor(outputFile?: string) {
    this.outputFile = outputFile;
  }

  start(performance: Performance): void {
    this.performance = performance;
    this.stanzaResults = [];
    this.startTime = Date.now();
  }

  stanzaStart(_stanza: Stanza): void {
    // JUnit formatter buffers everything
  }

  stanzaComplete(stanza: Stanza, result: StanzaResult): void {
    this.stanzaResults.push({ stanza, result });
  }

  complete(result: PlaybackResult): void {
    const duration = (Date.now() - this.startTime) / 1000;
    const timestamp = new Date().toISOString();

    const testCases = this.stanzaResults.map(({ stanza, result }) => {
      const testDuration = result.duration / 1000;
      const className = this.sanitize(this.performance!.name);
      const testName = this.sanitize(stanza.description || stanza.id);

      if (result.status === 'passed') {
        return `    <testcase classname="${className}" name="${testName}" time="${testDuration.toFixed(3)}" />`;
      } else if (result.status === 'failed') {
        const failureMessage = this.sanitize(
          result.error?.message || 
          result.assertionResults?.filter(a => !a.passed).map(a => a.expected).join(', ') ||
          'Stanza failed'
        );
        return `    <testcase classname="${className}" name="${testName}" time="${testDuration.toFixed(3)}">
      <failure message="${failureMessage}">
${this.formatFailureDetails(result)}
      </failure>
    </testcase>`;
      } else {
        return `    <testcase classname="${className}" name="${testName}" time="${testDuration.toFixed(3)}">
      <skipped />
    </testcase>`;
      }
    }).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="${this.sanitize(this.performance!.name)}" tests="${result.summary.total}" failures="${result.summary.failed}" skipped="${result.summary.skipped}" time="${duration.toFixed(3)}" timestamp="${timestamp}">
${testCases}
  </testsuite>
</testsuites>`;

    if (this.outputFile) {
      writeFileSync(this.outputFile, xml, 'utf-8');
    } else {
      console.log(xml);
    }
  }

  flush(): void {
    // Output happens in complete()
  }

  private sanitize(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private formatFailureDetails(result: StanzaResult): string {
    const lines: string[] = [];

    if (result.error) {
      lines.push(`Error: ${result.error.message}`);
      if (result.error.code) {
        lines.push(`Code: ${result.error.code}`);
      }
    }

    if (result.assertionResults) {
      result.assertionResults.filter(a => !a.passed).forEach(a => {
        lines.push(`Assertion failed: ${a.expected}`);
        if (a.actual) {
          lines.push(`  Actual: ${a.actual}`);
        }
      });
    }

    return this.sanitize(lines.join('\n'));
  }
}
```

**Sample Output:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="Login and Send Message" tests="5" failures="1" skipped="0" time="0.420" timestamp="2024-01-15T10:30:00.000Z">
    <testcase classname="Login and Send Message" name="Login as Alice" time="0.245" />
    <testcase classname="Login and Send Message" name="Wait for login response" time="0.052" />
    <testcase classname="Login and Send Message" name="Send message to Bob" time="0.018" />
    <testcase classname="Login and Send Message" name="Wait for message delivery" time="0.103">
      <failure message="Timeout waiting for response">
Error: Timeout waiting for response (10000ms)
      </failure>
    </testcase>
    <testcase classname="Login and Send Message" name="Check message received" time="0.000">
      <skipped />
    </testcase>
  </testsuite>
</testsuites>
```

**Verification:**
- Valid JUnit XML format
- Jenkins can parse it
- GitHub Actions can parse it
- Failures include details

---

### 6. Create GitHub Actions Example
**Priority:** 🟡 HIGH  
**Estimate:** 2-3 hours

**Description:**  
Create example GitHub Actions workflow for running Performances in CI.

**Tasks:**
- [ ] Create `.github/workflows/virtuoso-tests.yml` example
- [ ] Document environment variable setup
- [ ] Document artifact upload for results

**New File - `examples/github-actions/virtuoso-tests.yml`:**
```yaml
name: XMPP Integration Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

jobs:
  integration-tests:
    runs-on: ubuntu-latest
    
    services:
      # Optional: local XMPP server for testing
      prosody:
        image: prosody/prosody
        ports:
          - 5222:5222
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build Virtuoso CLI
        run: npm run build:cli
      
      - name: Run Integration Tests
        env:
          # Account credentials from GitHub Secrets
          VIRTUOSO_ALICE_JID: ${{ secrets.TEST_ALICE_JID }}
          VIRTUOSO_ALICE_PASSWORD: ${{ secrets.TEST_ALICE_PASSWORD }}
          VIRTUOSO_BOB_JID: ${{ secrets.TEST_BOB_JID }}
          VIRTUOSO_BOB_PASSWORD: ${{ secrets.TEST_BOB_PASSWORD }}
        run: |
          npx virtuoso run tests/login-flow.performance.json \
            --format junit \
            --output results/login-flow.xml
          
          npx virtuoso run tests/messaging.performance.json \
            --format junit \
            --output results/messaging.xml
      
      - name: Upload Test Results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results
          path: results/
      
      - name: Publish Test Report
        uses: mikepenz/action-junit-report@v4
        if: always()
        with:
          report_paths: 'results/*.xml'
          fail_on_failure: true
```

**Documentation in `docs/ci-integration.md`:**
```markdown
# CI/CD Integration

## GitHub Actions

### Setting Up Secrets

1. Go to your repository Settings → Secrets → Actions
2. Add the following secrets:
   - `TEST_ALICE_JID` - Test account JID (e.g., alice@test.example.com)
   - `TEST_ALICE_PASSWORD` - Test account password
   - `TEST_BOB_JID` - Second test account JID
   - `TEST_BOB_PASSWORD` - Second test account password

### Environment Variable Format

Virtuoso looks for account credentials in environment variables:

```bash
# Individual account format
VIRTUOSO_<ALIAS>_JID=user@domain.com
VIRTUOSO_<ALIAS>_PASSWORD=secret

# JSON array format (alternative)
VIRTUOSO_ACCOUNTS='[{"alias":"alice","jid":"alice@example.com","password":"secret"}]'
```

### Exit Codes

- `0` - All tests passed
- `1` - One or more tests failed
- `2` - Error (file not found, connection failed, etc.)
```

**Verification:**
- Workflow syntax is valid
- Secrets documented clearly
- Example runs successfully in CI

---

### 7. Implement Headless Performance Runner
**Priority:** 🔴 CRITICAL  
**Estimate:** 4-5 hours

**Description:**  
Adapt the Performance runner to work without Electron/GUI dependencies.

**Tasks:**
- [ ] Create `src/cli/performanceRunnerCli.ts`
- [ ] Use AccountManager instead of electron-store
- [ ] Handle XMPP events directly
- [ ] Report progress via callbacks

**New File - `src/cli/performanceRunnerCli.ts`:**
```typescript
import type { Performance, Stanza, StanzaResult, PlaybackResult } from '../types/performance';
import { AccountManager } from './accountManager';
import { processPlaceholders, type PlaceholderContext } from '../main/placeholderProcessor';
import { evaluateAssertions, type AssertionContext } from '../main/assertionEngine';

export interface RunnerOptions {
  performance: Performance;
  accountManager: AccountManager;
  timeout?: number;
  failFast?: boolean;
  onStanzaStart?: (stanza: Stanza) => void;
  onStanzaComplete?: (stanza: Stanza, result: StanzaResult) => void;
  onLog?: (message: string) => void;
}

export class PerformanceRunner {
  private options: RunnerOptions;
  private generatedIds: Map<string, string> = new Map();
  private responseBuffer: Map<string, string[]> = new Map();

  constructor(options: RunnerOptions) {
    this.options = options;
  }

  async run(): Promise<PlaybackResult> {
    const { performance, accountManager, failFast, onLog } = this.options;
    const results: StanzaResult[] = [];
    const startTime = Date.now();

    // Connect all required accounts
    const requiredAccounts = this.extractRequiredAccounts(performance);
    
    for (const alias of requiredAccounts) {
      onLog?.(`Connecting account: ${alias}`);
      try {
        const conn = await accountManager.connect(alias);
        
        // Set up stanza listener for responses
        conn.client.on('stanza', (stanza) => {
          const xml = stanza.toString();
          if (!this.responseBuffer.has(alias)) {
            this.responseBuffer.set(alias, []);
          }
          this.responseBuffer.get(alias)!.push(xml);
        });
      } catch (error) {
        return {
          performanceId: performance.id,
          status: 'failed',
          duration: Date.now() - startTime,
          stanzaResults: [],
          summary: { total: performance.stanzas.length, passed: 0, failed: 1, skipped: 0 },
        };
      }
    }

    // Execute stanzas
    let stopped = false;
    
    for (const stanza of performance.stanzas) {
      if (stopped) {
        results.push({
          stanzaId: stanza.id,
          status: 'skipped',
          duration: 0,
        });
        continue;
      }

      this.options.onStanzaStart?.(stanza);
      const result = await this.executeStanza(stanza);
      results.push(result);
      this.options.onStanzaComplete?.(stanza, result);

      if (result.status === 'failed' && failFast) {
        stopped = true;
      }
    }

    // Calculate summary
    const summary = {
      total: results.length,
      passed: results.filter(r => r.status === 'passed').length,
      failed: results.filter(r => r.status === 'failed').length,
      skipped: results.filter(r => r.status === 'skipped').length,
    };

    return {
      performanceId: performance.id,
      status: summary.failed === 0 ? 'passed' : 'failed',
      duration: Date.now() - startTime,
      stanzaResults: results,
      summary,
    };
  }

  private async executeStanza(stanza: Stanza): Promise<StanzaResult> {
    const startTime = Date.now();
    const timeout = this.options.timeout || 10000;

    try {
      switch (stanza.type) {
        case 'send':
          return await this.executeSend(stanza, startTime);

        case 'cue':
          return await this.executeCue(stanza, startTime, timeout);

        case 'assert':
          return await this.executeAssert(stanza, startTime);

        default:
          return {
            stanzaId: stanza.id,
            status: 'failed',
            duration: Date.now() - startTime,
            error: { message: `Unknown stanza type: ${stanza.type}` },
          };
      }
    } catch (error) {
      return {
        stanzaId: stanza.id,
        status: 'failed',
        duration: Date.now() - startTime,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  private async executeSend(stanza: Stanza, startTime: number): Promise<StanzaResult> {
    if (stanza.data.type !== 'send') {
      throw new Error('Invalid stanza data for send');
    }

    const account = stanza.account;
    if (!account) {
      throw new Error('No account specified for send');
    }

    // Process placeholders
    const context: PlaceholderContext = {
      variables: {},
      generateId: (key) => {
        const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.generatedIds.set(key, id);
        return id;
      },
    };

    const processedXml = processPlaceholders(stanza.data.xml, context);

    // Send via account manager
    await this.options.accountManager.send(account, processedXml);

    return {
      stanzaId: stanza.id,
      status: 'passed',
      duration: Date.now() - startTime,
      sentXml: processedXml,
    };
  }

  private async executeCue(
    stanza: Stanza, 
    startTime: number, 
    timeout: number
  ): Promise<StanzaResult> {
    if (stanza.data.type !== 'cue') {
      throw new Error('Invalid stanza data for cue');
    }

    const account = stanza.account;
    if (!account) {
      throw new Error('No account specified for cue');
    }

    const cueData = stanza.data;
    const cueTimeout = cueData.timeout || timeout;

    // Wait for matching response
    const response = await this.waitForResponse(
      account,
      cueData.matchType,
      cueData.matchExpression,
      cueTimeout
    );

    return {
      stanzaId: stanza.id,
      status: 'passed',
      duration: Date.now() - startTime,
      receivedXml: response,
    };
  }

  private async executeAssert(stanza: Stanza, startTime: number): Promise<StanzaResult> {
    if (stanza.data.type !== 'assert') {
      throw new Error('Invalid stanza data for assert');
    }

    const account = stanza.account;
    const responses = account ? this.responseBuffer.get(account) || [] : [];
    
    // Get last response
    const lastResponse = responses[responses.length - 1] || '';

    const context: AssertionContext = {
      xml: lastResponse,
      accountId: account || '',
    };

    const assertionResults = evaluateAssertions(stanza.data.assertions, context);
    const allPassed = assertionResults.every(r => r.passed);

    return {
      stanzaId: stanza.id,
      status: allPassed ? 'passed' : 'failed',
      duration: Date.now() - startTime,
      assertionResults,
    };
  }

  private waitForResponse(
    accountAlias: string,
    matchType: string,
    expression: string,
    timeout: number
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkBuffer = () => {
        const buffer = this.responseBuffer.get(accountAlias) || [];
        
        for (const xml of buffer) {
          if (this.matchesExpression(xml, matchType, expression)) {
            resolve(xml);
            return;
          }
        }
        
        if (Date.now() - startTime > timeout) {
          reject(new Error(`Timeout waiting for response (${timeout}ms)`));
          return;
        }
        
        // Check again in 50ms
        setTimeout(checkBuffer, 50);
      };
      
      checkBuffer();
    });
  }

  private matchesExpression(xml: string, matchType: string, expression: string): boolean {
    switch (matchType) {
      case 'id':
        return xml.includes(`id="${expression}"`) || xml.includes(`id='${expression}'`);
      case 'contains':
        return xml.includes(expression);
      case 'regex':
        return new RegExp(expression).test(xml);
      default:
        return false;
    }
  }

  private extractRequiredAccounts(performance: Performance): string[] {
    const accounts = new Set<string>();
    performance.stanzas.forEach(s => {
      if (s.account) accounts.add(s.account);
    });
    return Array.from(accounts);
  }
}
```

**Verification:**
- Runs without Electron
- Connects to XMPP servers
- Executes stanzas in order
- Reports results via callbacks

---

### 8. Add CLI Build Configuration
**Priority:** 🟡 HIGH  
**Estimate:** 2-3 hours

**Description:**  
Configure build system for CLI-only distribution.

**Tasks:**
- [ ] Add build script for CLI
- [ ] Create separate tsconfig for CLI
- [ ] Ensure no Electron dependencies in CLI build
- [ ] Test npx execution

**Create `tsconfig.cli.json`:**
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist/cli",
    "declaration": true
  },
  "include": [
    "src/cli/**/*",
    "src/types/**/*",
    "src/main/placeholderProcessor.ts",
    "src/main/assertionEngine.ts"
  ],
  "exclude": [
    "src/main/main.ts",
    "src/main/preload.ts",
    "src/renderer/**/*"
  ]
}
```

**Update `package.json`:**
```json
{
  "scripts": {
    "build:cli": "tsc -p tsconfig.cli.json && chmod +x dist/cli/conductor.js",
    "cli": "ts-node src/cli/conductor.ts"
  },
  "bin": {
    "virtuoso": "./dist/cli/conductor.js"
  },
  "files": [
    "dist/cli/**/*"
  ]
}
```

**Verification:**
- `npm run build:cli` succeeds
- No Electron imports in CLI build
- `npx virtuoso run test.json` works
- Can publish to npm

---

## 📊 Sprint Summary

| Task | Priority | Estimate | Dependencies |
|------|----------|----------|--------------|
| CLI entry point | 🔴 CRITICAL | 4-5 hours | None |
| Account manager | 🔴 CRITICAL | 4-5 hours | None |
| Console formatter | 🔴 CRITICAL | 3-4 hours | CLI entry point |
| JSON formatter | 🔴 CRITICAL | 2-3 hours | CLI entry point |
| JUnit formatter | 🟡 HIGH | 3-4 hours | CLI entry point |
| GitHub Actions example | 🟡 HIGH | 2-3 hours | JUnit formatter |
| Headless runner | 🔴 CRITICAL | 4-5 hours | Account manager |
| CLI build config | 🟡 HIGH | 2-3 hours | All above |

**Total Estimate: 26-32 hours (2 weeks at ~15 hours/week)**

---

## ✅ Definition of Done

- [ ] `npx virtuoso run performance.json` works
- [ ] accounts.json credentials loaded
- [ ] Environment variable credentials work
- [ ] Console output is readable
- [ ] JSON output is valid
- [ ] JUnit XML output works with GitHub Actions
- [ ] Exit code 0 on success
- [ ] Exit code 1 on test failure
- [ ] Exit code 2 on error
- [ ] CLI works without Electron installed
- [ ] Documentation includes CI/CD examples
