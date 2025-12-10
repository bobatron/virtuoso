# Performances & Conductor Feature Specification

## 🎭 Overview

Performances is a recording and playback system for XMPP interactions, similar to how Postman Collections work for REST APIs. Users can **compose** a sequence of XMPP actions (connecting, sending stanzas, receiving responses), add assertions, and replay them later for testing or demonstration purposes.

**Composer** is the UI feature that records user actions into a Performance.

**Conductor** is the CLI mode that executes Performances headlessly, enabling integration with CI/CD pipelines. Conductor runs using the existing Virtuoso backend (not a separate tool), allowing the same application to work both as a desktop GUI and as a command-line test runner.

## 🎯 Goals

1. **Compose** - Record XMPP interactions as they happen in the UI
2. **Replay** - Execute recorded Performances with assertions
3. **Assert** - Validate responses match expected patterns
4. **Export** - Save Performances to shareable file format
5. **CLI** - Run Performances from command line for automation (via Conductor mode)

## 📋 Terminology

| Term | Description |
|------|-------------|
| **Performance** | A composed sequence of XMPP interactions and assertions |
| **Stanza** | A single action within a Performance (connect, disconnect, send, cue, assert) |
| **Movement** | An optional logical grouping of Stanzas within a Performance |
| **Composer** | The UI mode/feature for composing actions into a Performance |
| **Conductor** | The CLI mode that runs Performances headlessly |
| **Cue** | A wait point that pauses until a specific response is received before continuing |

*Note: All terminology follows a musical theme - Virtuoso (the app), Performance (a test), Stanza (an action), Movement (a grouping), Composer (recording UI), Conductor (CLI runner).*

---

## 🎬 Feature Details

### 1. UI Layout

#### Current Layout (Left Side - Accounts)
The existing left sidebar contains:
- Add account button
- List of accounts with connect/disconnect toggle
- Clicking an account shows its stanza editor and responses in the main area

#### New Layout (Right Side - Performances)
A new right sidebar will be added for Performances:

```
┌─────────────────────────────────────────────────────────────────────┐
│                           VIRTUOSO                                   │
├──────────┬─────────────────────────────────────────┬────────────────┤
│ ACCOUNTS │              MAIN AREA                  │  PERFORMANCES  │
│          │                                         │                │
│ + Add    │  ┌─────────────────────────────────┐   │ [Compose New]  │
│          │  │  Stanza Editor                  │   │                │
│ ○ Alice  │  │  (for selected account)         │   │ My Performances│
│ ● Bob    │  │                                 │   │ ├─ Login Test  │
│ ○ Carol  │  └─────────────────────────────────┘   │ ├─ MUC Join    │
│          │                                         │ └─ Message Flow│
│          │  ┌─────────────────────────────────┐   │                │
│          │  │  Responses                      │   │ ── Composing ──│
│          │  │  (for selected account)         │   │ ● Recording... │
│          │  │                                 │   │ 1: Connect     │
│          │  │                                 │   │    as Bob      │
│          │  │                                 │   │ 2: Send        │
│          │  │                                 │   │    message     │
│          │  └─────────────────────────────────┘   │ [Stop] [Cancel]│
└──────────┴─────────────────────────────────────────┴────────────────┘
```

#### Right Sidebar States

**Default State (Not Composing)**
- "Compose New" button at top
- List of saved Performances
- Click Performance to view/edit/play

**Composing State (Recording)**
- Recording indicator (red dot)
- Live list of captured Stanzas
- Each Stanza shows: account name + action (e.g., "Bob sends message")
- Stop button to finish and save
- Cancel button to discard

---

### 2. Composer (Recording Mode)

#### How It Works
1. User clicks "Compose New" in the right sidebar
2. Composer enters composing mode (visual indicator appears)
3. **Actions are captured as they happen (no delays recorded):**
   - Toggle account connection → "Connect as Bob" or "Disconnect Bob"
   - Send stanza → "Bob sends message" (with full XML captured)
   - Click on response → Option to add Cue (wait-for) or assertion
4. User clicks "Stop" to finish composing
5. User names and saves the Performance

**Important:** Delays are **not** automatically captured. The time a user takes to compose is irrelevant - only the actions matter. Timing during playback is controlled by intentional **Cues** (wait for response) that the user explicitly adds.

#### Actions Captured

| User Action | Captured Stanza |
|-------------|-----------------|
| Toggle account ON | `connect` - "Connect as {account}" |
| Toggle account OFF | `disconnect` - "Disconnect {account}" |
| Send stanza | `send` - "{account} sends message" |
| Click response + "Wait for this" | `cue` - "Wait for response matching..." |
| Click response + "Assert this" | `assert` - "Assert response contains..." |

**Not captured:** Time between actions. A user might take 5 minutes to craft a message - that's fine, the Performance will just show the sequence of stanzas without delays.

#### Composer UI Elements
- **Compose Button** - "Compose New" in right sidebar header
- **Recording Indicator** - Red dot + "Composing..." label
- **Live Stanza List** - Real-time display of captured stanzas
- **Stop Button** - Finish composing, prompt to save
- **Cancel Button** - Discard composition

---

### 3. Response Handling & Cues

When composing, users can interact with responses to create Cues (wait points) or assertions:

#### Why Cues Matter
Since delays are not automatically captured during composing, **Cues are the mechanism for timing control**. Without a Cue, stanzas execute immediately one after another. A Cue tells the Performance: "wait here until this response arrives before continuing."

#### Adding Cues and Assertions from Responses
1. While composing, user sends a stanza
2. Response appears in the response viewer
3. User clicks on the response (or right-clicks for context menu)
4. Options appear:
   - **"Wait for this before continuing"** - Add a Cue that pauses playback until this response arrives
   - **"Assert this response"** - Add assertion that validates this response
   - **"Extract value from this"** - Store a value from this response in a variable

#### Cue (Wait for Response)
A Cue is a special Stanza that pauses Performance playback until a matching response is received. This is **the primary timing mechanism** in Performances.

```typescript
interface CueData {
  description: string;       // "Wait for presence acknowledgment"
  matchType: 'contains' | 'xpath' | 'regex' | 'id';
  matchExpression: string;   // What to match in the response
  timeout: number;           // Max wait time in ms (default 10000)
  fromAccount: string;       // Which account should receive this
}
```

**Example Flow:**
1. Compose: Bob connects
2. Compose: Bob sends presence to MUC room
3. Click on the presence acknowledgment response
4. Select "Wait for this before continuing" → Creates a Cue
5. Click on the response again
6. Select "Assert this response" → Creates an assertion
7. Continue composing next action...

**Result Performance:**
```
Stanza 1: Connect as Bob
Stanza 2: Bob sends presence to room@conference.example.com
Stanza 3: [Cue] Wait for presence acknowledgment (timeout: 10s)
Stanza 4: [Assert] Response contains "<presence from='room@..."
```

During playback, Stanza 3 (the Cue) will pause execution until the expected response arrives, then Stanza 4 validates it.

---

### 4. Template Placeholders

Templates use a `{{placeholder}}` syntax. When a template contains placeholders, Virtuoso automatically displays input fields above the stanza editor for each placeholder.

#### How It Works

**Template with placeholders:**
```xml
<message to="{{recipient}}" type="chat" id="{{$id}}">
  <body>{{messageBody}}</body>
</message>
```

**Virtuoso UI automatically shows:**
```
┌─────────────────────────────────────────┐
│  Template: Send Chat Message            │
├─────────────────────────────────────────┤
│  recipient: [_____________________]     │
│  messageBody: [___________________]     │
│  $id: [auto-generated: abc123]          │
├─────────────────────────────────────────┤
│  <message to="{{recipient}}" ...        │
│    <body>{{messageBody}}</body>         │
│  </message>                             │
└─────────────────────────────────────────┘
```

#### Placeholder Types

| Syntax | Type | Description |
|--------|------|-------------|
| `{{name}}` | User Input | User provides value in text field |
| `{{$id}}` | Auto-generated ID | Virtuoso generates unique ID, tracks for response correlation |
| `{{$timestamp}}` | Auto-generated | Current timestamp |
| `{{ENV_VAR}}` | Environment | Loaded from environment variable |

#### Auto-Generated IDs and Response Correlation

Many XMPP interactions use request/response patterns where the response contains the same `id` as the request:

**Request:**
```xml
<iq type="get" id="abc123">
  <query xmlns="jabber:iq:roster"/>
</iq>
```

**Response:**
```xml
<iq type="result" id="abc123">
  <query xmlns="jabber:iq:roster">
    <item jid="alice@example.com"/>
  </query>
</iq>
```

When you use `{{$id}}` in a template:
1. Virtuoso generates a unique ID (e.g., `virt_1702234567890_001`)
2. The ID is shown in the UI (read-only, can be copied)
3. Virtuoso **automatically knows to look for responses with that ID**
4. When creating a Cue, you can select "Wait for response with this ID" - Virtuoso will match by the `id` attribute

This makes response correlation automatic and reliable.

#### Benefits
- **One template, many uses** - Same template works for different recipients, messages, etc.
- **No custom UI per message type** - Placeholders work for any XML structure
- **Extensible** - Users create their own templates with whatever placeholders they need
- **ID tracking** - `{{$id}}` enables automatic request/response correlation

---

### 5. Performance Structure

```typescript
interface Performance {
  id: string;
  name: string;
  description: string;
  version: string;  // Schema version for compatibility
  created: string;  // ISO timestamp
  updated: string;  // ISO timestamp
  
  // Account references (credentials loaded from accounts.json or env vars)
  accounts: AccountReference[];
  
  // Sequential list of stanzas (actions)
  stanzas: Stanza[];
  
  // Optional: Movements for logical grouping of stanzas
  movements?: Movement[];
  
  // Performance-level variables
  variables: Record<string, string>;
  
  // Metadata
  tags: string[];
  author?: string;
}


interface AccountReference {
  alias: string;      // Reference name used in stanzas (e.g., "bob")
  jid: string;        // Full JID or variable pattern (e.g., "{{BOB_JID}}")
  // Credentials NOT stored - loaded from accounts.json or environment at runtime
}

interface Movement {
  id: string;
  name: string;       // e.g., "Setup", "Main Test", "Teardown"
  description?: string;
  stanzas: Stanza[];
}

interface Stanza {
  id: string;
  type: 'connect' | 'disconnect' | 'send' | 'cue' | 'assert';
  accountAlias: string;  // Which account this stanza applies to
  description: string;   // Human-readable, e.g., "Bob sends message to Alice"
  
  // Type-specific data
  data: ConnectData | DisconnectData | SendData | CueData | AssertData;
  
  // Optional assertions on this stanza's result
  assertions?: Assertion[];
}

interface ConnectData {
  // Connection uses account reference - credentials loaded at runtime
}

interface DisconnectData {
  // Just disconnects the referenced account
}

interface SendData {
  stanza: string;  // XML stanza (supports {{placeholder}} interpolation)
  generatedIds?: Record<string, string>;  // Track {{$id}} values for correlation
}

interface CueData {
  description: string;
  matchType: 'contains' | 'xpath' | 'regex' | 'id';  // 'id' matches by stanza id attribute
  matchExpression: string;
  timeout: number;  // Max wait time in ms (default 10000)
  correlatedId?: string;  // If matchType is 'id', this is the {{$id}} value to match
}

interface AssertData {
  type: 'xpath' | 'contains' | 'regex' | 'equals';
  expression: string;
  expected?: string;
}

interface Assertion {
  id: string;
  name: string;
  type: 'xpath' | 'contains' | 'regex' | 'equals' | 'exists' | 'count';
  expression: string;
  expected: string | number | boolean;
  negate?: boolean;  // Assert the opposite
}
```

**Note:** There is no `DelayData` type. Delays are not captured during composing. Timing is controlled entirely by Cues. If a user needs a fixed delay (rare), they can manually add one after composing, but this is discouraged in favor of Cues.

---

### 6. Credential Handling

Performances **never store passwords**. Credentials are loaded at runtime from external sources.

#### Option 1: accounts.json File
Reuse the existing `accounts.json` mechanism:

```json
{
  "accounts": [
    {
      "alias": "bob",
      "jid": "bob@xmpp.example.com",
      "password": "bob-password",
      "host": "xmpp.example.com",
      "port": 5222
    },
    {
      "alias": "alice", 
      "jid": "alice@xmpp.example.com",
      "password": "alice-password"
    }
  ]
}
```

```bash
# Run with accounts file
virtuoso conduct ./test.performance.json --accounts ./accounts.json
```

#### Option 2: Environment Variables
Performance files can reference environment variables:

```json
{
  "accounts": [
    {
      "alias": "bob",
      "jid": "{{BOB_JID}}",
      "passwordEnv": "BOB_PASSWORD"
    }
  ]
}
```

```bash
# Run with environment variables
BOB_JID="bob@server.com" BOB_PASSWORD="secret" virtuoso conduct ./test.performance.json
```

#### Option 3: CLI Arguments
Pass credentials directly (useful for CI secrets):

```bash
virtuoso conduct ./test.performance.json \
  --account bob="bob@server.com:password123" \
  --account alice="alice@server.com:password456"
```

#### Precedence Order
1. CLI arguments (highest priority)
2. Environment variables  
3. accounts.json file
4. Saved accounts in Virtuoso (desktop mode only)

---

### 6. Execution Model

#### Sequential Execution
All stanzas execute **sequentially**, one after another. This keeps Performances simple and predictable.

**Example Performance:**
```
Stanza 1: Connect as Bob
Stanza 2: Connect as Alice  
Stanza 3: Bob sends message to Alice
Stanza 4: Wait for Alice to receive message (Cue)
Stanza 5: Assert message contains "Hello"
Stanza 6: Disconnect Bob
Stanza 7: Disconnect Alice
```

Even with multiple accounts, stanzas run in order. This avoids complex parallel synchronization issues.

---

### 7. Assertion System

#### Assertion Types

| Type | Description | Example |
|------|-------------|---------|
| `contains` | Response contains substring | `"<success/>"` |
| `xpath` | XPath expression matches | `//body/text() = 'Hello'` |
| `regex` | Regex pattern matches | `jid="[^"]+@example\.com"` |
| `equals` | Exact string match | Full XML comparison |
| `exists` | Element exists (XPath) | `//message[@type='chat']` |
| `count` | Count of elements matches | `count(//item) > 5` |

#### Adding Assertions
1. **While Composing** - Click on a received stanza to add assertion or cue
2. **After Composing** - Edit Performance and add assertions to any stanza
3. **Quick Assert** - Right-click response → "Assert this response..."

#### Assertion UI
- Visual assertion builder (no code required)
- XPath helper with autocomplete
- Test assertion against captured response
- Show pass/fail preview

---

### 8. Playback System

#### How Playback Works

Stanzas execute **sequentially and immediately** unless a Cue is encountered:

```
Stanza 1: Connect as Bob          → Executes immediately
Stanza 2: Bob sends message       → Executes immediately after Stanza 1 completes
Stanza 3: [Cue] Wait for response → PAUSES until response received (or timeout)
Stanza 4: [Assert] Contains "ok"  → Executes immediately after Cue resolves
Stanza 5: Disconnect Bob          → Executes immediately
```

**There are no automatic delays.** Cues provide all timing control.

#### Playback Modes

| Mode | Description |
|------|-------------|
| **Normal** | Execute stanzas sequentially, pause only at Cues |
| **Stepped** | Pause after each stanza, require manual "Continue" |
| **Debug** | Stepped + show detailed logs and response data |

#### Playback UI
- **Play/Pause/Stop** controls
- **Progress indicator** showing current stanza
- **Stanza list** with pass/fail indicators (✓ or ✗)
- **Response viewer** showing actual vs expected
- **Variables panel** showing current placeholder values
- **Log panel** showing detailed execution

#### Playback Results

```typescript
interface PlaybackResult {
  performanceId: string;
  status: 'passed' | 'failed' | 'error' | 'stopped';
  startTime: string;
  endTime: string;
  duration: number;
  
  stanzaResults: StanzaResult[];
  
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
}

interface StanzaResult {
  stanzaId: string;
  status: 'passed' | 'failed' | 'error' | 'skipped';
  duration: number;
  
  // For send stanzas
  sentXml?: string;
  
  // For assertions
  assertionResults?: AssertionResult[];
  
  // Error details if failed
  error?: {
    message: string;
    details?: string;
  };
}
```

---

### 9. Export/Import Format

#### File Format
- **Extension:** `.virtuoso` or `.performance.json`
- **Format:** JSON (human-readable, version controlled)
- **Compression:** Optional gzip for large files

#### Export Options
- Export single Performance
- Export multiple Performances as bundle
- Include/exclude captured responses
- Include/exclude variable values
- Export for specific Virtuoso version

#### Import Behavior
- Validate schema version
- Check for account reference conflicts
- Preview changes before import
- Merge or replace existing Performances

---

### 10. Conductor CLI (Headless Mode)

Conductor is **not a separate tool** - it's a CLI mode built into Virtuoso that reuses the existing backend. This means:
- Same XMPP handling code as the desktop app
- No separate package to install or maintain
- Guaranteed compatibility between GUI and CLI

#### How It Works
The Virtuoso Electron app can run in two modes:
1. **Desktop Mode** (default) - Full GUI with Composer, Playback, etc.
2. **Conductor Mode** - Headless execution, no GUI, outputs to stdout

```
┌─────────────────────────────────────────────────────────────┐
│                      VIRTUOSO                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Shared Backend                          │    │
│  │  - XMPP Connection Manager                          │    │
│  │  - Performance Runner                               │    │
│  │  - Assertion Engine                                 │    │
│  │  - Account Manager                                  │    │
│  └─────────────────────────────────────────────────────┘    │
│           │                              │                   │
│           ▼                              ▼                   │
│  ┌─────────────────┐          ┌─────────────────────┐       │
│  │  Desktop Mode   │          │  Conductor Mode     │       │
│  │  (Electron GUI) │          │  (Headless CLI)     │       │
│  │                 │          │                     │       │
│  │  - Composer UI  │          │  - stdout output    │       │
│  │  - Playback UI  │          │  - exit codes       │       │
│  │  - Sidebar      │          │  - CI/CD friendly   │       │
│  └─────────────────┘          └─────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

#### Basic Usage
```bash
# Run Virtuoso in Conductor mode
virtuoso conduct ./login-test.performance.json

# Run with accounts.json file
virtuoso conduct ./test.performance.json --accounts ./accounts.json

# Run with account credentials via CLI
virtuoso conduct ./test.performance.json \
  --account bob="bob@server.com:password123" \
  --account alice="alice@server.com:password456"

# Run with variables
virtuoso conduct ./test.performance.json \
  --var server="test.xmpp.org" \
  --var room="testroom"

# Run multiple Performances
virtuoso conduct ./tests/*.performance.json

# Specify output format
virtuoso conduct ./test.performance.json --output json
virtuoso conduct ./test.performance.json --output junit
```

#### Exit Codes
| Code | Meaning |
|------|---------|
| 0 | All Performances passed |
| 1 | One or more Performances failed |
| 2 | Error (file not found, invalid format, connection error) |

#### Output Formats

**Console (default)**
```
🎭 Running: Login Test Performance
  ✓ Stanza 1: Connect as bob
  ✓ Stanza 2: Connect as alice
  ✓ Stanza 3: Bob sends message to alice
  ✓ Stanza 4: Wait for alice to receive message
  ✓ Stanza 5: Assert message contains "Hello"
  ✓ Stanza 6: Disconnect bob
  ✓ Stanza 7: Disconnect alice

✓ 1 Performance passed (7 stanzas, 0 failed)
Duration: 2.34s
```

**JSON**
```json
{
  "performances": [{
    "name": "Login Test Performance",
    "status": "passed",
    "duration": 2340,
    "stanzas": { "total": 7, "passed": 7, "failed": 0 }
  }],
  "summary": { "passed": 1, "failed": 0 }
}
```

**JUnit XML** (for CI integration)
```xml
<testsuite name="Login Test Performance" tests="7" failures="0" time="2.34">
  <testcase name="Connect as bob" time="0.45"/>
  <testcase name="Connect as alice" time="0.38"/>
  ...
</testsuite>
```

#### CI/CD Integration Examples

**GitHub Actions**
```yaml
name: XMPP Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup XMPP Server
        run: docker-compose up -d xmpp-server
        
      - name: Run XMPP Tests
        run: |
          npx virtuoso conduct ./tests/*.performance.json \
            --accounts ./test-accounts.json \
            --output junit > test-results.xml
            
      - name: Publish Test Results
        uses: EnricoMi/publish-unit-test-result-action@v2
        if: always()
        with:
          files: test-results.xml
```

**GitLab CI**
```yaml
xmpp-tests:
  stage: test
  services:
    - name: prosody/prosody
      alias: xmpp-server
  script:
    - npx virtuoso conduct ./tests/*.performance.json --accounts ./ci-accounts.json --output junit > report.xml
  artifacts:
    reports:
      junit: report.xml
```

---

## 🔄 Relationship to Existing Features

### Templates & Placeholders

The existing template system is enhanced with placeholder support:

| Feature | Current | Enhanced |
|---------|---------|----------|
| Templates | Static XML snippets | XML with `{{placeholder}}` syntax |
| Editing | Edit XML directly | Auto-generated input fields for placeholders |
| IDs | Manual entry | `{{$id}}` auto-generates and tracks |
| Reusability | Copy/paste and edit | Same template, different values |

### Collections vs Performances

| Aspect | Collections (Phase 3) | Performances |
|--------|----------------------|--------------|
| **Creation** | Manual template organization | Composing live interactions |
| **Purpose** | Organize stanza templates | Test automation & replay |
| **Execution** | One-off sends | Scripted sequences with Cues & assertions |
| **Output** | Response viewer | Pass/fail test results |
| **CLI** | Not planned | Conductor mode |

### Integration Points
- **Templates → Performances**: Composed Performances capture the resolved template XML
- **Placeholders**: Shared `{{placeholder}}` system between templates and Performances
- **`{{$id}}`**: Auto-generated IDs work in templates and enable response correlation in Performances

---

## 🛠 Implementation Phases

### Phase A: Template Placeholders & Core Composing (MVP)
**Estimate: 2-3 weeks**

- [ ] Template placeholder parsing (`{{name}}` syntax)
- [ ] Auto-generated input fields for placeholders in UI
- [ ] `{{$id}}` auto-generation
- [ ] Performance data model and storage
- [ ] Basic composing (start/stop, capture actions)
- [ ] Basic playback (sequential execution)
- [ ] Performance list UI (right sidebar)
- [ ] Export to JSON file

### Phase B: Cues, Assertions & Response Correlation
**Estimate: 2 weeks**

- [ ] Cue system (wait for specific response)
- [ ] ID-based response correlation (`{{$id}}` tracking)
- [ ] Click-on-response to add Cue or assertion
- [ ] Simple assertions (contains, equals)
- [ ] XPath assertions with builder UI
- [ ] Regex assertions  
- [ ] Edit composed Performance
- [ ] Import Performances

### Phase C: Conductor Mode
**Estimate: 2 weeks**

- [ ] Headless CLI entry point (`virtuoso conduct`)
- [ ] accounts.json file loading
- [ ] Environment variable support
- [ ] CLI argument parsing for credentials
- [ ] Console output formatter
- [ ] JSON output formatter
- [ ] JUnit XML output
- [ ] Exit code handling

### Phase D: Polish & Advanced Features
**Estimate: 1-2 weeks**

- [ ] Playback modes (stepped, debug)
- [ ] Performance bundles (run multiple)
- [ ] Better error messages and diagnostics
- [ ] Performance templates / examples
- [ ] Movements for organizing stanzas (optional grouping)

---

## 📁 New Files Required

```
src/
  main/
    performanceStore.ts       # Performance persistence (JSON files)
    performanceRunner.ts      # Execution engine (shared by GUI & CLI)
    conductorMode.ts          # CLI entry point and output formatters
    placeholderParser.ts      # Parse {{placeholder}} syntax from templates
    idGenerator.ts            # Generate unique IDs for {{$id}}
    
  renderer/
    components/
      templates/
        PlaceholderFields.tsx       # Auto-generated input fields for placeholders
        
      performances/
        PerformancesSidebar.tsx     # Right sidebar container
        PerformanceList.tsx         # List saved Performances
        PerformanceEditor.tsx       # Edit Performance details
        Composer.tsx                # Composing mode controls
        ComposerStanzaList.tsx      # Live list during composing
        PlaybackControls.tsx        # Play/pause/stop
        StanzaItem.tsx              # Single stanza display
        AssertionBuilder.tsx        # Visual assertion creator
        CueBuilder.tsx              # Wait-for-response builder
        PlaybackResults.tsx         # Results display
        ResponseActions.tsx         # Context menu for response (add cue/assert)
        
    hooks/
      useComposer.ts                # Composing state management
      usePlayback.ts                # Playback state management
      usePlaceholders.ts            # Extract and manage placeholders from templates
      
  types/
    performance.ts                  # TypeScript interfaces
    placeholder.ts                  # Placeholder types
```

---

## ✅ Design Decisions (Resolved)

| Question | Decision |
|----------|----------|
| **Delay Capture** | **No delays captured during composing.** User time to compose is irrelevant. Timing controlled by Cues only. |
| **Credential Handling** | Credentials loaded from `accounts.json` file OR environment variables OR CLI arguments. Never stored in Performance files. |
| **Response Matching** | User clicks on response during composing to create Cue (wait-for) or assertion. Cues have configurable timeout. ID-based correlation via `{{$id}}`. |
| **Multi-Account Sync** | Sequential execution only. Stanzas run one after another regardless of which account they apply to. |
| **Performance Versioning** | No versioning for now. Saving overwrites. Can revisit in future. |
| **Conductor Architecture** | Reuse existing backend. Conductor is a CLI mode of Virtuoso, not a separate tool. |
| **Template Extensibility** | `{{placeholder}}` syntax in templates auto-generates UI input fields. No custom UI needed per message type. |
| **Request/Response Correlation** | `{{$id}}` placeholder auto-generates unique IDs. Virtuoso tracks these to match responses by `id` attribute. |

---

## 🎯 Success Metrics

- Users can compose a 5-stanza Performance in under 2 minutes
- Playback correctly reproduces composed actions
- Cues reliably wait for expected responses (no flaky timing)
- CLI runs Performances with 0% false failures
- JUnit output integrates with major CI systems
- 90% of common XMPP test scenarios can be expressed
- Template placeholders reduce need for custom UI code

---

## 📝 Notes

- Consider implementing Composer after the core MVP features are stable
- Conductor mode reuses the same backend, reducing maintenance burden
- Performance files are JSON for easy version control and diffing
- The right sidebar layout keeps the existing left sidebar intact
- All terminology follows a musical theme: Virtuoso, Performance, Stanza, Movement, Composer, Conductor
- Template placeholders are a foundational feature - implement early as they benefit both regular use and Performances
