# Sprint 4: Polish & Advanced Features (1-2 weeks)

## 🎯 Sprint Goal

Add polish, advanced playback modes, organizational features (Movements), and create templates/examples to make Virtuoso production-ready.

## 📋 Success Criteria

- [ ] Stepped playback mode (step through one stanza at a time)
- [ ] Debug mode (verbose output, shows all XML)
- [ ] Performance bundles (multiple Performances in sequence)
- [ ] Movement support for organizing stanzas
- [ ] Clear, actionable error messages
- [ ] Template/example Performances included
- [ ] User documentation complete
- [ ] README updated with full feature list

## 📦 Prerequisites

- Sprint 3 completed
- Conductor CLI working
- All core features functional

---

## 🔨 Work Items

### 1. Implement Stepped Playback Mode
**Priority:** 🟡 HIGH  
**Estimate:** 4-5 hours

**Description:**  
Allow users to step through a Performance one stanza at a time, useful for debugging and understanding flow.

**Tasks:**
- [ ] Add playback mode selector to UI
- [ ] Implement stepped execution in runner
- [ ] Show "Next" button in stepped mode
- [ ] Display current stanza details
- [ ] Allow editing variables between steps

**Update `src/renderer/components/performances/PlaybackControls.tsx`:**
```tsx
import React, { useState } from 'react';

export type PlaybackMode = 'continuous' | 'stepped' | 'debug';

interface PlaybackControlsProps {
  isPlaying: boolean;
  isPaused: boolean;
  mode: PlaybackMode;
  currentStanza?: string;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onStep: () => void;
  onModeChange: (mode: PlaybackMode) => void;
}

export function PlaybackControls({
  isPlaying,
  isPaused,
  mode,
  currentStanza,
  onPlay,
  onPause,
  onStop,
  onStep,
  onModeChange,
}: PlaybackControlsProps): JSX.Element {
  return (
    <div className="playback-controls">
      <div className="playback-mode-selector">
        <label>Mode:</label>
        <select 
          value={mode} 
          onChange={(e) => onModeChange(e.target.value as PlaybackMode)}
          disabled={isPlaying}
        >
          <option value="continuous">Continuous</option>
          <option value="stepped">Stepped</option>
          <option value="debug">Debug (Verbose)</option>
        </select>
      </div>

      <div className="playback-buttons">
        {!isPlaying && (
          <button onClick={onPlay} className="btn-primary">
            ▶ Play
          </button>
        )}
        
        {isPlaying && mode === 'continuous' && (
          <button onClick={onPause} className="btn-secondary">
            {isPaused ? '▶ Resume' : '⏸ Pause'}
          </button>
        )}
        
        {isPlaying && (mode === 'stepped' || isPaused) && (
          <button onClick={onStep} className="btn-primary">
            ⏭ Step
          </button>
        )}
        
        {isPlaying && (
          <button onClick={onStop} className="btn-danger">
            ⏹ Stop
          </button>
        )}
      </div>

      {currentStanza && mode === 'stepped' && (
        <div className="current-stanza-info">
          <span className="label">Current:</span>
          <span className="value">{currentStanza}</span>
        </div>
      )}
    </div>
  );
}
```

**Update `src/main/performanceRunner.ts` for stepped mode:**
```typescript
export interface RunnerState {
  mode: 'continuous' | 'stepped' | 'debug';
  currentIndex: number;
  isPaused: boolean;
  waitingForStep: boolean;
}

export class PerformanceRunner extends EventEmitter {
  private state: RunnerState = {
    mode: 'continuous',
    currentIndex: 0,
    isPaused: false,
    waitingForStep: false,
  };

  private stepResolve?: () => void;

  setMode(mode: RunnerState['mode']): void {
    this.state.mode = mode;
  }

  async run(): Promise<PlaybackResult> {
    for (let i = 0; i < this.performance.stanzas.length; i++) {
      this.state.currentIndex = i;
      const stanza = this.performance.stanzas[i];

      // In stepped mode, wait for user to step
      if (this.state.mode === 'stepped' && i > 0) {
        this.state.waitingForStep = true;
        this.emit('waitingForStep', stanza);
        
        await new Promise<void>((resolve) => {
          this.stepResolve = resolve;
        });
        
        this.state.waitingForStep = false;
      }

      // In debug mode, log everything
      if (this.state.mode === 'debug') {
        this.emit('debug', `Executing stanza ${i + 1}/${this.performance.stanzas.length}`);
        this.emit('debug', `Type: ${stanza.type}, Account: ${stanza.account || 'N/A'}`);
      }

      // Execute stanza
      const result = await this.executeStanza(stanza);
      
      if (this.state.mode === 'debug' && result.sentXml) {
        this.emit('debug', `Sent XML:\n${result.sentXml}`);
      }
      if (this.state.mode === 'debug' && result.receivedXml) {
        this.emit('debug', `Received XML:\n${result.receivedXml}`);
      }

      // ... rest of execution
    }
  }

  /**
   * Advance to next stanza in stepped mode
   */
  step(): void {
    if (this.stepResolve) {
      this.stepResolve();
      this.stepResolve = undefined;
    }
  }

  /**
   * Get current stanza being executed
   */
  getCurrentStanza(): Stanza | undefined {
    return this.performance.stanzas[this.state.currentIndex];
  }
}
```

**Verification:**
- Stepped mode pauses after each stanza
- "Step" button advances to next
- Can stop mid-Performance
- Debug mode shows all XML

---

### 2. Implement Debug Mode with Verbose Output
**Priority:** 🟡 HIGH  
**Estimate:** 3-4 hours

**Description:**  
Add verbose debug mode that shows all XML traffic and internal state.

**Tasks:**
- [ ] Add debug panel to UI
- [ ] Show raw XML in/out
- [ ] Show placeholder resolution
- [ ] Show timing information
- [ ] Log assertion evaluation details

**New File - `src/renderer/components/performances/DebugPanel.tsx`:**
```tsx
import React, { useRef, useEffect } from 'react';

interface DebugLog {
  timestamp: number;
  type: 'info' | 'send' | 'receive' | 'assert' | 'error';
  message: string;
  details?: string;
}

interface DebugPanelProps {
  logs: DebugLog[];
  isVisible: boolean;
  onClear: () => void;
}

export function DebugPanel({
  logs,
  isVisible,
  onClear,
}: DebugPanelProps): JSX.Element | null {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  if (!isVisible) return null;

  const formatTime = (ts: number): string => {
    return new Date(ts).toISOString().substr(11, 12);
  };

  const getTypeIcon = (type: DebugLog['type']): string => {
    switch (type) {
      case 'send': return '→';
      case 'receive': return '←';
      case 'assert': return '✓';
      case 'error': return '✗';
      default: return '•';
    }
  };

  return (
    <div className="debug-panel">
      <div className="debug-header">
        <h3>Debug Log</h3>
        <button onClick={onClear}>Clear</button>
      </div>
      
      <div className="debug-content">
        {logs.map((log, index) => (
          <div key={index} className={`debug-entry debug-${log.type}`}>
            <span className="debug-time">{formatTime(log.timestamp)}</span>
            <span className="debug-icon">{getTypeIcon(log.type)}</span>
            <span className="debug-message">{log.message}</span>
            {log.details && (
              <pre className="debug-details">{log.details}</pre>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
```

**CSS for Debug Panel:**
```css
.debug-panel {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 250px;
  background: var(--bg-primary);
  border-top: 2px solid var(--border-color);
  display: flex;
  flex-direction: column;
  z-index: 100;
}

.debug-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.debug-header h3 {
  margin: 0;
  font-size: 14px;
}

.debug-content {
  flex: 1;
  overflow-y: auto;
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 12px;
  padding: 8px;
}

.debug-entry {
  padding: 4px 0;
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.debug-time {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.debug-icon {
  width: 16px;
  text-align: center;
  flex-shrink: 0;
}

.debug-send .debug-icon { color: #4CAF50; }
.debug-receive .debug-icon { color: #2196F3; }
.debug-assert .debug-icon { color: #9C27B0; }
.debug-error .debug-icon { color: #f44336; }

.debug-message {
  flex: 1;
}

.debug-details {
  margin: 4px 0 0 32px;
  padding: 8px;
  background: var(--bg-secondary);
  border-radius: 4px;
  overflow-x: auto;
  font-size: 11px;
}
```

**Verification:**
- Debug panel shows in debug mode
- Sent XML logged
- Received XML logged
- Assertion results detailed
- Can clear log

---

### 3. Implement Performance Bundles
**Priority:** 🟢 MEDIUM  
**Estimate:** 4-5 hours

**Description:**  
Allow running multiple Performances in sequence as a bundle/suite.

**Tasks:**
- [ ] Define bundle format (`.bundle.json`)
- [ ] Create bundle runner
- [ ] Support shared variables across Performances
- [ ] Aggregate results
- [ ] CLI support for bundles

**New File - `src/types/bundle.ts`:**
```typescript
import type { Performance, PlaybackResult } from './performance';

export interface PerformanceBundle {
  id: string;
  name: string;
  description?: string;
  created: string;
  updated: string;
  
  /**
   * Performances to run in order
   */
  performances: BundleEntry[];
  
  /**
   * Shared variables available to all Performances
   */
  sharedVariables?: Record<string, string>;
  
  /**
   * Continue running if a Performance fails?
   */
  continueOnFailure?: boolean;
}

export interface BundleEntry {
  /**
   * Path to Performance file (relative or absolute)
   */
  path: string;
  
  /**
   * Optional name override
   */
  name?: string;
  
  /**
   * Skip this Performance?
   */
  skip?: boolean;
  
  /**
   * Variables specific to this Performance
   */
  variables?: Record<string, string>;
}

export interface BundleResult {
  bundleId: string;
  bundleName: string;
  status: 'passed' | 'failed';
  duration: number;
  results: Array<{
    performancePath: string;
    performanceName: string;
    result: PlaybackResult;
  }>;
  summary: {
    totalPerformances: number;
    passedPerformances: number;
    failedPerformances: number;
    skippedPerformances: number;
    totalStanzas: number;
    passedStanzas: number;
    failedStanzas: number;
  };
}
```

**New File - `src/main/bundleRunner.ts`:**
```typescript
import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import type { PerformanceBundle, BundleEntry, BundleResult } from '../types/bundle';
import type { Performance, PlaybackResult } from '../types/performance';
import { PerformanceRunner } from './performanceRunner';
import { AccountManager } from '../cli/accountManager';

export class BundleRunner {
  private bundle: PerformanceBundle;
  private basePath: string;
  private accountManager: AccountManager;

  constructor(
    bundlePath: string,
    accountManager: AccountManager
  ) {
    this.basePath = dirname(bundlePath);
    const content = readFileSync(bundlePath, 'utf-8');
    this.bundle = JSON.parse(content);
    this.accountManager = accountManager;
  }

  async run(): Promise<BundleResult> {
    const startTime = Date.now();
    const results: BundleResult['results'] = [];
    let stopped = false;

    for (const entry of this.bundle.performances) {
      if (entry.skip) {
        continue;
      }

      if (stopped && !this.bundle.continueOnFailure) {
        continue;
      }

      const performance = await this.loadPerformance(entry);
      
      // Merge variables
      const variables = {
        ...this.bundle.sharedVariables,
        ...entry.variables,
      };

      const runner = new PerformanceRunner({
        performance,
        accountManager: this.accountManager,
        variables,
      });

      const result = await runner.run();

      results.push({
        performancePath: entry.path,
        performanceName: entry.name || performance.name,
        result,
      });

      if (result.status === 'failed') {
        stopped = true;
      }
    }

    // Calculate summary
    const summary = this.calculateSummary(results);

    return {
      bundleId: this.bundle.id,
      bundleName: this.bundle.name,
      status: summary.failedPerformances === 0 ? 'passed' : 'failed',
      duration: Date.now() - startTime,
      results,
      summary,
    };
  }

  private async loadPerformance(entry: BundleEntry): Promise<Performance> {
    const fullPath = resolve(this.basePath, entry.path);
    
    if (!existsSync(fullPath)) {
      throw new Error(`Performance not found: ${entry.path}`);
    }

    const content = readFileSync(fullPath, 'utf-8');
    return JSON.parse(content);
  }

  private calculateSummary(
    results: BundleResult['results']
  ): BundleResult['summary'] {
    return {
      totalPerformances: results.length,
      passedPerformances: results.filter(r => r.result.status === 'passed').length,
      failedPerformances: results.filter(r => r.result.status === 'failed').length,
      skippedPerformances: this.bundle.performances.filter(p => p.skip).length,
      totalStanzas: results.reduce((sum, r) => sum + r.result.summary.total, 0),
      passedStanzas: results.reduce((sum, r) => sum + r.result.summary.passed, 0),
      failedStanzas: results.reduce((sum, r) => sum + r.result.summary.failed, 0),
    };
  }
}
```

**Example bundle file:**
```json
{
  "id": "smoke-tests",
  "name": "Smoke Test Suite",
  "description": "Basic functionality tests",
  "created": "2024-01-15T10:00:00.000Z",
  "updated": "2024-01-15T10:00:00.000Z",
  "performances": [
    {
      "path": "tests/login.performance.json",
      "name": "Login Flow"
    },
    {
      "path": "tests/messaging.performance.json",
      "name": "Basic Messaging"
    },
    {
      "path": "tests/presence.performance.json",
      "name": "Presence Updates"
    }
  ],
  "sharedVariables": {
    "testDomain": "test.example.com"
  },
  "continueOnFailure": true
}
```

**CLI update for bundle:**
```typescript
program
  .command('run-bundle')
  .description('Run a Performance bundle')
  .argument('<bundle>', 'Path to bundle file (.bundle.json)')
  .option('-a, --accounts <file>', 'Path to accounts.json')
  .option('-f, --format <format>', 'Output format', 'console')
  .action(async (bundlePath: string, options) => {
    // ... bundle execution
  });
```

**Verification:**
- Bundle loads all Performances
- Shared variables work
- Results aggregated
- CLI can run bundles

---

### 4. Implement Movements for Stanza Organization
**Priority:** 🟢 MEDIUM  
**Estimate:** 4-5 hours

**Description:**  
Add Movements to group related stanzas together for better organization.

**Tasks:**
- [ ] Update Performance type with movements
- [ ] UI for creating/editing Movements
- [ ] Visual grouping in playback view
- [ ] Collapse/expand Movement groups
- [ ] Movement-level skip option

**Update `src/types/performance.ts`:**
```typescript
export interface Movement {
  id: string;
  name: string;
  description?: string;
  
  /**
   * IDs of stanzas in this Movement
   */
  stanzaIds: string[];
  
  /**
   * Skip this entire Movement?
   */
  skip?: boolean;
  
  /**
   * Collapse in UI?
   */
  collapsed?: boolean;
}

export interface Performance {
  // ... existing fields
  
  /**
   * Optional groupings of stanzas
   */
  movements?: Movement[];
}
```

**New File - `src/renderer/components/performances/MovementGroup.tsx`:**
```tsx
import React, { useState } from 'react';
import { StanzaItem } from './StanzaItem';
import type { Movement, Stanza, StanzaResult } from '../../../types/performance';

interface MovementGroupProps {
  movement: Movement;
  stanzas: Stanza[];
  results: Map<string, StanzaResult>;
  currentStanzaId: string | null;
  onToggleCollapse: (movementId: string) => void;
  onSkipMovement: (movementId: string, skip: boolean) => void;
}

export function MovementGroup({
  movement,
  stanzas,
  results,
  currentStanzaId,
  onToggleCollapse,
  onSkipMovement,
}: MovementGroupProps): JSX.Element {
  const movementStanzas = stanzas.filter(s => 
    movement.stanzaIds.includes(s.id)
  );

  const passedCount = movementStanzas.filter(s => 
    results.get(s.id)?.status === 'passed'
  ).length;
  
  const failedCount = movementStanzas.filter(s => 
    results.get(s.id)?.status === 'failed'
  ).length;

  const getStatus = (): 'pending' | 'running' | 'passed' | 'failed' => {
    if (failedCount > 0) return 'failed';
    if (currentStanzaId && movement.stanzaIds.includes(currentStanzaId)) return 'running';
    if (passedCount === movementStanzas.length && passedCount > 0) return 'passed';
    return 'pending';
  };

  return (
    <div className={`movement-group movement-${getStatus()}`}>
      <div 
        className="movement-header"
        onClick={() => onToggleCollapse(movement.id)}
      >
        <span className="movement-toggle">
          {movement.collapsed ? '▶' : '▼'}
        </span>
        <span className="movement-name">{movement.name}</span>
        <span className="movement-count">
          ({movementStanzas.length} stanzas)
        </span>
        {passedCount > 0 && (
          <span className="movement-passed">{passedCount} ✓</span>
        )}
        {failedCount > 0 && (
          <span className="movement-failed">{failedCount} ✗</span>
        )}
        <label 
          className="movement-skip"
          onClick={(e) => e.stopPropagation()}
        >
          <input 
            type="checkbox"
            checked={movement.skip || false}
            onChange={(e) => onSkipMovement(movement.id, e.target.checked)}
          />
          Skip
        </label>
      </div>
      
      {!movement.collapsed && (
        <div className="movement-stanzas">
          {movementStanzas.map((stanza, index) => (
            <StanzaItem
              key={stanza.id}
              stanza={stanza}
              index={index + 1}
              status={
                currentStanzaId === stanza.id 
                  ? 'running' 
                  : results.get(stanza.id)?.status || 'pending'
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

**CSS for Movements:**
```css
.movement-group {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  margin-bottom: 12px;
  overflow: hidden;
}

.movement-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--bg-secondary);
  cursor: pointer;
}

.movement-header:hover {
  background: var(--bg-hover);
}

.movement-toggle {
  font-size: 10px;
  color: var(--text-secondary);
}

.movement-name {
  font-weight: 600;
  flex: 1;
}

.movement-count {
  color: var(--text-secondary);
  font-size: 13px;
}

.movement-passed {
  color: var(--success);
  font-size: 12px;
}

.movement-failed {
  color: var(--error);
  font-size: 12px;
}

.movement-skip {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-secondary);
}

.movement-stanzas {
  padding: 8px 16px 16px;
}

.movement-passed {
  border-left: 3px solid var(--success);
}

.movement-failed {
  border-left: 3px solid var(--error);
}

.movement-running {
  border-left: 3px solid var(--info);
}
```

**Verification:**
- Movements group stanzas visually
- Can collapse/expand
- Can skip entire Movement
- Status aggregates from stanzas

---

### 5. Improve Error Messages
**Priority:** 🟡 HIGH  
**Estimate:** 3-4 hours

**Description:**  
Make error messages clear, actionable, and helpful.

**Tasks:**
- [ ] Create error message catalog
- [ ] Add context to errors
- [ ] Suggest fixes where possible
- [ ] Include relevant stanza info

**New File - `src/errors/messages.ts`:**
```typescript
export interface ErrorDetails {
  code: string;
  title: string;
  message: string;
  suggestion?: string;
  context?: Record<string, unknown>;
}

export const ErrorCodes = {
  // Connection errors
  CONNECTION_FAILED: 'E001',
  AUTH_FAILED: 'E002',
  CONNECTION_TIMEOUT: 'E003',
  CONNECTION_LOST: 'E004',

  // Account errors
  ACCOUNT_NOT_FOUND: 'E010',
  ACCOUNT_NOT_CONNECTED: 'E011',
  INVALID_CREDENTIALS: 'E012',

  // Performance errors
  PERFORMANCE_NOT_FOUND: 'E020',
  INVALID_PERFORMANCE: 'E021',
  STANZA_FAILED: 'E022',

  // Cue errors
  CUE_TIMEOUT: 'E030',
  CUE_INVALID_EXPRESSION: 'E031',
  CUE_NO_MATCH: 'E032',

  // Assertion errors
  ASSERTION_FAILED: 'E040',
  ASSERTION_INVALID: 'E041',

  // Placeholder errors
  PLACEHOLDER_UNDEFINED: 'E050',
  PLACEHOLDER_INVALID: 'E051',
} as const;

export function createError(
  code: string,
  context?: Record<string, unknown>
): ErrorDetails {
  const base = errorTemplates[code];
  
  if (!base) {
    return {
      code: 'E999',
      title: 'Unknown Error',
      message: `An unknown error occurred (${code})`,
      context,
    };
  }

  // Interpolate context into message
  let message = base.message;
  let suggestion = base.suggestion;

  if (context) {
    Object.entries(context).forEach(([key, value]) => {
      message = message.replace(`{${key}}`, String(value));
      if (suggestion) {
        suggestion = suggestion.replace(`{${key}}`, String(value));
      }
    });
  }

  return {
    code,
    title: base.title,
    message,
    suggestion,
    context,
  };
}

const errorTemplates: Record<string, Omit<ErrorDetails, 'code' | 'context'>> = {
  [ErrorCodes.CONNECTION_FAILED]: {
    title: 'Connection Failed',
    message: 'Failed to connect to {host}:{port}',
    suggestion: 'Check that the server is running and the host/port are correct.',
  },
  [ErrorCodes.AUTH_FAILED]: {
    title: 'Authentication Failed',
    message: 'Authentication failed for {jid}',
    suggestion: 'Verify the username and password are correct.',
  },
  [ErrorCodes.CONNECTION_TIMEOUT]: {
    title: 'Connection Timeout',
    message: 'Connection to {host} timed out after {timeout}ms',
    suggestion: 'The server may be unreachable. Check network connectivity.',
  },
  [ErrorCodes.ACCOUNT_NOT_FOUND]: {
    title: 'Account Not Found',
    message: 'Account "{alias}" is not configured',
    suggestion: 'Add the account to accounts.json or set VIRTUOSO_{ALIAS}_JID and VIRTUOSO_{ALIAS}_PASSWORD environment variables.',
  },
  [ErrorCodes.CUE_TIMEOUT]: {
    title: 'Cue Timeout',
    message: 'Timeout waiting for {matchType} match: "{expression}" after {timeout}ms',
    suggestion: 'The expected response may not have been sent, or the match expression may be incorrect.',
  },
  [ErrorCodes.ASSERTION_FAILED]: {
    title: 'Assertion Failed',
    message: '{assertionType} assertion failed',
    suggestion: 'Expected: {expected}\nActual: {actual}',
  },
  [ErrorCodes.PLACEHOLDER_UNDEFINED]: {
    title: 'Undefined Placeholder',
    message: 'Placeholder "{name}" is not defined',
    suggestion: 'Define the variable in the Performance inputs or set it via environment variable.',
  },
};

/**
 * Format error for display
 */
export function formatError(error: ErrorDetails): string {
  const lines = [
    `[${error.code}] ${error.title}`,
    error.message,
  ];

  if (error.suggestion) {
    lines.push('');
    lines.push(`💡 ${error.suggestion}`);
  }

  return lines.join('\n');
}

/**
 * Format error for console output with colors
 */
export function formatErrorConsole(error: ErrorDetails): string {
  const red = '\x1b[31m';
  const yellow = '\x1b[33m';
  const dim = '\x1b[2m';
  const reset = '\x1b[0m';

  const lines = [
    `${red}[${error.code}] ${error.title}${reset}`,
    error.message,
  ];

  if (error.suggestion) {
    lines.push('');
    lines.push(`${yellow}💡 ${error.suggestion}${reset}`);
  }

  return lines.join('\n');
}
```

**Verification:**
- Errors include error code
- Message explains what happened
- Suggestion tells how to fix
- Context provided where helpful

---

### 6. Create Template Performances
**Priority:** 🟢 MEDIUM  
**Estimate:** 3-4 hours

**Description:**  
Include example Performances for common XMPP scenarios.

**Tasks:**
- [ ] Create examples directory
- [ ] Login flow example
- [ ] Messaging example
- [ ] Presence example
- [ ] MUC (group chat) example
- [ ] Document each example

**New Directory - `examples/performances/`:**

**`examples/performances/login-basic.performance.json`:**
```json
{
  "id": "login-basic",
  "name": "Basic Login Flow",
  "description": "Simple login and resource binding",
  "version": "1.0.0",
  "created": "2024-01-15T10:00:00.000Z",
  "updated": "2024-01-15T10:00:00.000Z",
  "inputs": [],
  "stanzas": [
    {
      "id": "login-1",
      "type": "cue",
      "account": "alice",
      "description": "Wait for stream features after login",
      "data": {
        "type": "cue",
        "matchType": "contains",
        "matchExpression": "<stream:features>",
        "timeout": 10000
      }
    },
    {
      "id": "login-2", 
      "type": "assert",
      "account": "alice",
      "description": "Verify SASL mechanisms available",
      "data": {
        "type": "assert",
        "assertions": [
          {
            "id": "has-sasl",
            "type": "contains",
            "expression": "<mechanisms xmlns='urn:ietf:params:xml:ns:xmpp-sasl'>"
          }
        ]
      }
    }
  ]
}
```

**`examples/performances/messaging-simple.performance.json`:**
```json
{
  "id": "messaging-simple",
  "name": "Simple Message Exchange",
  "description": "Send a message from Alice to Bob and verify receipt",
  "version": "1.0.0",
  "created": "2024-01-15T10:00:00.000Z",
  "updated": "2024-01-15T10:00:00.000Z",
  "inputs": [
    {
      "name": "bobJid",
      "type": "string",
      "label": "Bob's JID",
      "required": true
    },
    {
      "name": "messageText",
      "type": "string",
      "label": "Message to send",
      "defaultValue": "Hello from Virtuoso!"
    }
  ],
  "stanzas": [
    {
      "id": "msg-1",
      "type": "send",
      "account": "alice",
      "description": "Send message to Bob",
      "data": {
        "type": "send",
        "xml": "<message to='{{bobJid}}' type='chat' id='{{$id:msg1}}'><body>{{messageText}}</body></message>"
      }
    },
    {
      "id": "msg-2",
      "type": "cue",
      "account": "bob",
      "description": "Wait for message receipt",
      "data": {
        "type": "cue",
        "matchType": "contains",
        "matchExpression": "{{messageText}}",
        "timeout": 5000
      }
    },
    {
      "id": "msg-3",
      "type": "assert",
      "account": "bob",
      "description": "Verify message content",
      "data": {
        "type": "assert",
        "assertions": [
          {
            "id": "body-match",
            "type": "xpath",
            "expression": "//body/text()",
            "expected": "{{messageText}}"
          }
        ]
      }
    }
  ]
}
```

**`examples/performances/presence-update.performance.json`:**
```json
{
  "id": "presence-update",
  "name": "Presence Update Flow",
  "description": "Update presence and verify broadcast to contacts",
  "version": "1.0.0",
  "created": "2024-01-15T10:00:00.000Z",
  "updated": "2024-01-15T10:00:00.000Z",
  "inputs": [
    {
      "name": "statusText",
      "type": "string",
      "label": "Status message",
      "defaultValue": "Available for testing"
    }
  ],
  "stanzas": [
    {
      "id": "pres-1",
      "type": "send",
      "account": "alice",
      "description": "Send presence update",
      "data": {
        "type": "send",
        "xml": "<presence><show>chat</show><status>{{statusText}}</status></presence>"
      }
    },
    {
      "id": "pres-2",
      "type": "cue",
      "account": "bob",
      "description": "Wait for presence broadcast",
      "data": {
        "type": "cue",
        "matchType": "xpath",
        "matchExpression": "//presence/status",
        "timeout": 5000
      }
    },
    {
      "id": "pres-3",
      "type": "assert",
      "account": "bob",
      "description": "Verify status text",
      "data": {
        "type": "assert",
        "assertions": [
          {
            "id": "status-match",
            "type": "xpath",
            "expression": "//presence/status/text()",
            "expected": "{{statusText}}"
          }
        ]
      }
    }
  ]
}
```

**Create `examples/README.md`:**
```markdown
# Virtuoso Example Performances

This directory contains example Performances demonstrating common XMPP testing scenarios.

## Examples

### 1. Basic Login (`login-basic.performance.json`)
Tests basic XMPP login flow and SASL mechanism availability.

**Accounts Required:** alice

**Inputs:** None

### 2. Simple Messaging (`messaging-simple.performance.json`)
Sends a message from Alice to Bob and verifies receipt.

**Accounts Required:** alice, bob

**Inputs:**
- `bobJid` (required): Bob's full JID
- `messageText` (optional): Message content

### 3. Presence Update (`presence-update.performance.json`)
Updates presence status and verifies broadcast to contacts.

**Accounts Required:** alice, bob

**Inputs:**
- `statusText` (optional): Status message to set

## Running Examples

```bash
# With accounts.json
npx virtuoso run examples/performances/login-basic.performance.json -a accounts.json

# With environment variables
export VIRTUOSO_ALICE_JID=alice@example.com
export VIRTUOSO_ALICE_PASSWORD=secret
npx virtuoso run examples/performances/login-basic.performance.json
```
```

**Verification:**
- Examples are valid JSON
- Can run each example
- Documentation clear

---

### 7. Update Documentation
**Priority:** 🟡 HIGH  
**Estimate:** 4-5 hours

**Description:**  
Complete user documentation and update README.

**Tasks:**
- [ ] Update README.md with full feature list
- [ ] Create user guide
- [ ] Document all features
- [ ] Add troubleshooting section

**Create `docs/user-guide.md`:**
```markdown
# Virtuoso User Guide

## Table of Contents
1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Composing Performances](#composing-performances)
4. [Placeholders](#placeholders)
5. [Cues & Assertions](#cues--assertions)
6. [Conductor (CLI)](#conductor-cli)
7. [CI/CD Integration](#cicd-integration)
8. [Troubleshooting](#troubleshooting)

## Introduction

Virtuoso is an XMPP testing tool that allows you to record, replay, and automate XMPP interactions. Think of it as a macro recorder for XMPP protocol testing.

### Key Concepts

- **Performance**: A recorded sequence of XMPP actions
- **Stanza**: A single action in a Performance (send, cue, assert)
- **Movement**: An optional grouping of related stanzas
- **Composer**: The UI for recording Performances
- **Conductor**: The CLI for running Performances in CI/CD

## Getting Started

### Installation

```bash
# Clone and install
git clone https://github.com/bobatron/virtuoso.git
cd virtuoso
npm install
npm run dev
```

### Your First Performance

1. Connect to XMPP accounts in the main app
2. Click "Compose" to start recording
3. Send some messages
4. Click responses to add Cues
5. Click "Stop" and save your Performance
6. Click "Play" to replay

## Composing Performances

### Starting a Recording

1. Ensure at least one XMPP account is connected
2. Click the **Compose** button
3. All sent stanzas will be captured

### Capturing Actions

- **Send actions**: Automatically captured when you send XML
- **Cues (wait points)**: Click on a response and select "Wait for this"
- **Assertions**: Click on a response and select "Assert this"

### Stopping & Saving

1. Click **Stop Composing**
2. Enter a name and description
3. Click **Save Performance**

## Placeholders

Use placeholders for dynamic values:

| Placeholder | Description |
|-------------|-------------|
| `{{name}}` | User-provided input when running |
| `{{$id}}` | Auto-generated unique ID |
| `{{$id:key}}` | Auto-generated ID with key for correlation |
| `{{$timestamp}}` | Current Unix timestamp |
| `{{$uuid}}` | Random UUID |
| `{{ENV_VAR}}` | Environment variable value |

### Example

```xml
<message to="{{recipientJid}}" id="{{$id:msg1}}">
  <body>{{messageText}}</body>
</message>
```

## Cues & Assertions

### Cues (Wait Points)

Cues pause playback until a matching response arrives:

- **ID Match**: Wait for response with specific ID
- **Contains**: Wait for response containing text
- **Regex**: Wait for response matching pattern
- **XPath**: Wait for response matching XPath

### Assertions

Assertions validate response content:

- **Contains**: Response contains text
- **Equals**: Response exactly matches
- **Regex**: Response matches pattern
- **XPath**: XPath expression returns expected value

## Conductor (CLI)

Run Performances from command line:

```bash
# Basic usage
npx virtuoso run my-test.performance.json

# With accounts file
npx virtuoso run my-test.json -a accounts.json

# JSON output for scripting
npx virtuoso run my-test.json -f json -o results.json

# JUnit output for CI
npx virtuoso run my-test.json -f junit -o results.xml
```

### Account Configuration

**accounts.json:**
```json
{
  "accounts": [
    {
      "alias": "alice",
      "jid": "alice@example.com",
      "password": "secret"
    }
  ]
}
```

**Environment Variables:**
```bash
export VIRTUOSO_ALICE_JID=alice@example.com
export VIRTUOSO_ALICE_PASSWORD=secret
```

## CI/CD Integration

See [CI Integration Guide](./ci-integration.md) for GitHub Actions, Jenkins, etc.

## Troubleshooting

### Common Issues

**"Account not found"**
- Ensure account alias in Performance matches accounts.json
- Check environment variables are set correctly

**"Connection failed"**  
- Verify XMPP server is running
- Check hostname and port
- Ensure credentials are correct

**"Cue timeout"**
- Expected response may not have arrived
- Check match expression is correct
- Increase timeout value

### Getting Help

- GitHub Issues: [github.com/bobatron/virtuoso/issues](https://github.com/bobatron/virtuoso/issues)
```

**Verification:**
- README complete
- User guide covers all features
- Troubleshooting helpful

---

### 8. Final Polish & Testing
**Priority:** 🟡 HIGH  
**Estimate:** 4-5 hours

**Description:**  
Final cleanup, testing, and preparation for release.

**Tasks:**
- [ ] Run through all features manually
- [ ] Fix any UI inconsistencies
- [ ] Test on Windows, Mac, Linux
- [ ] Update version numbers
- [ ] Create release notes

**Checklist:**
```markdown
## Release Checklist

### Functionality
- [ ] Composing works end-to-end
- [ ] Playback works in GUI
- [ ] Conductor CLI works
- [ ] All output formats work
- [ ] Error messages are clear

### UI/UX
- [ ] Responsive layout
- [ ] Keyboard shortcuts work
- [ ] Dark mode consistent
- [ ] Loading states visible
- [ ] Error states clear

### Documentation
- [ ] README up to date
- [ ] User guide complete
- [ ] API documentation
- [ ] Example Performances work

### Cross-Platform
- [ ] Windows tested
- [ ] macOS tested
- [ ] Linux tested

### Build
- [ ] Production build works
- [ ] Installer creates correctly
- [ ] CLI publishable to npm
```

---

## 📊 Sprint Summary

| Task | Priority | Estimate | Dependencies |
|------|----------|----------|--------------|
| Stepped playback | 🟡 HIGH | 4-5 hours | Sprint 3 |
| Debug mode | 🟡 HIGH | 3-4 hours | Sprint 3 |
| Performance bundles | 🟢 MEDIUM | 4-5 hours | Sprint 3 |
| Movements | 🟢 MEDIUM | 4-5 hours | Sprint 1 |
| Error messages | 🟡 HIGH | 3-4 hours | All |
| Template Performances | 🟢 MEDIUM | 3-4 hours | Sprint 2 |
| Documentation | 🟡 HIGH | 4-5 hours | All |
| Final polish | 🟡 HIGH | 4-5 hours | All |

**Total Estimate: 30-37 hours (1.5-2 weeks at ~20 hours/week)**

---

## ✅ Definition of Done

- [ ] Stepped playback mode works
- [ ] Debug mode shows all XML traffic
- [ ] Performance bundles run correctly
- [ ] Movements organize stanzas visually
- [ ] Error messages are clear and helpful
- [ ] Example Performances included and documented
- [ ] README updated with full features
- [ ] User guide complete
- [ ] Tested on all platforms
- [ ] Ready for v0.1.0 release
