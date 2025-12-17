# Sprint 1: Template Placeholders & Core Composing (2-3 weeks)

## 🎯 Sprint Goal

Implement the template placeholder system and core Composer functionality, enabling users to create and play back basic Compositions.

## 📋 Success Criteria

- [x] Templates support `{{placeholder}}` syntax
- [x] Placeholders automatically generate input fields in UI
- [x] `{{$id}}` generates unique IDs and displays them
- [x] Composition data model implemented (types scaffolded)
- [x] Composer captures connect/disconnect/send actions
- [x] Basic sequential playback works (Conductor performs compositions via real XMPP)
- [x] Compositions saved to JSON files (Electron) or local fallback (dev)
- [x] Right sidebar shows Compositions list

## 🚦 Sprint Update (progress & deviations)
- **Terminology Change**: Renamed "Performance" to "Composition" for saved scripts. "Performance" now refers to the result of Conducting a Composition.
- Implemented compositions sidebar UI with add/delete/edit flows; save now uses an in-app modal (no system prompts).
- Composer captures connect/disconnect/send actions and saves compositions to Electron JSON store; when running Vite-only dev, falls back to localStorage to avoid data loss.
- Added edit modal for composition name/description; delete works.
- Plan change: removed system dialogs (prompt/confirm) in favor of React modals to prevent Electron focus issues.
- **Composer Tab Features (completed)**:
  - View compositions in list, click to view details
  - Load stanzas from composition into main UI
  - Remove individual stanzas from compositions
  - Record onto existing compositions ("Record More")
  - Reorder stanzas with up/down buttons
  - Import compositions from JSON files
- **Conductor Tab Features (completed)**:
  - Perform compositions with real XMPP execution (connect, send stanzas, disconnect)
  - Export compositions as JSON files
  - View performance results with pass/fail status, timing, and error details
  - Performances tab shows history of all executed compositions

## 📦 Prerequisites

- Sprint 0 (Lean Foundation) completed
- All backend code in TypeScript
- Type definitions in place

---

## 🔨 Work Items

### 1. Create Composition Type Definitions
**Priority:** 🔴 CRITICAL  
**Estimate:** 2-3 hours

**Description:**  
Add TypeScript interfaces for Compositions, Stanzas, Movements, and related types.

**Tasks:**
- [x] Create `src/types/composition.ts`
- [x] Add Composition interface
- [x] Add Stanza interface with all types
- [x] Add Movement interface
- [x] Add PlaybackResult interfaces
- [x] Export from `src/types/index.ts`

**New File - `src/types/composition.ts`:**
```typescript
export interface Composition {
  id: string;
  name: string;
  description: string;
  version: string;  // Schema version for compatibility
  created: string;  // ISO timestamp
  updated: string;  // ISO timestamp
  
  // Account references (credentials loaded at runtime)
  accounts: AccountReference[];
  
  // Sequential list of stanzas
  stanzas: Stanza[];
  
  // Optional: Movements for logical grouping
  movements?: Movement[];
  
  // Composition-level variables
  variables: Record<string, string>;
  
  // Metadata
  tags: string[];
  author?: string;
}

export interface AccountReference {
  alias: string;      // Reference name used in stanzas (e.g., "bob")
  jid: string;        // Full JID or variable pattern (e.g., "{{BOB_JID}}")
}

export interface Movement {
  id: string;
  name: string;       // e.g., "Setup", "Main Test", "Teardown"
  description?: string;
  stanzaIds: string[]; // References to stanza IDs in this movement
}

export interface Stanza {
  id: string;
  type: StanzaType;
  accountAlias: string;
  description: string;
  data: StanzaData;
  assertions?: Assertion[];
}

export type StanzaType = 'connect' | 'disconnect' | 'send' | 'cue' | 'assert';

export type StanzaData = 
  | ConnectData 
  | DisconnectData 
  | SendData 
  | CueData 
  | AssertData;

export interface ConnectData {
  type: 'connect';
}

export interface DisconnectData {
  type: 'disconnect';
}

export interface SendData {
  type: 'send';
  xml: string;  // The XML stanza (with placeholders resolved)
  generatedIds?: Record<string, string>;  // Track {{$id}} values
}

export interface CueData {
  type: 'cue';
  description: string;
  matchType: 'contains' | 'xpath' | 'regex' | 'id';
  matchExpression: string;
  timeout: number;  // ms, default 10000
  correlatedId?: string;  // For id matching
}

export interface AssertData {
  type: 'assert';
  assertionType: 'xpath' | 'contains' | 'regex' | 'equals';
  expression: string;
  expected?: string;
}

export interface Assertion {
  id: string;
  name: string;
  type: 'xpath' | 'contains' | 'regex' | 'equals' | 'exists' | 'count';
  expression: string;
  expected: string | number | boolean;
  negate?: boolean;
}

// Playback results
export interface PlaybackResult {
  compositionId: string;
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

export interface StanzaResult {
  stanzaId: string;
  status: 'passed' | 'failed' | 'error' | 'skipped';
  duration: number;
  sentXml?: string;
  receivedXml?: string;
  assertionResults?: AssertionResult[];
  error?: {
    message: string;
    details?: string;
  };
}

export interface AssertionResult {
  assertionId: string;
  passed: boolean;
  actual?: string;
  expected?: string;
  error?: string;
}
```

**Verification:**
- Types compile without errors
- Types can be imported in other files

---

### 2. Create Placeholder Type Definitions
**Priority:** 🔴 CRITICAL  
**Estimate:** 1 hour

**Description:**  
Add TypeScript interfaces for the placeholder system.

**Tasks:**
- [x] Create `src/types/placeholder.ts`
- [x] Add Placeholder interface
- [x] Add parsed placeholder types
- [x] Export from `src/types/index.ts`

**New File - `src/types/placeholder.ts`:**
```typescript
export interface Placeholder {
  name: string;           // The placeholder name (without braces)
  fullMatch: string;      // The full match including braces, e.g., "{{name}}"
  type: PlaceholderType;
  startIndex: number;     // Position in the original string
  endIndex: number;
}

export type PlaceholderType = 
  | 'user'        // {{name}} - user provides value
  | 'id'          // {{$id}} - auto-generated unique ID
  | 'timestamp'   // {{$timestamp}} - auto-generated timestamp
  | 'env';        // {{ENV_VAR}} - environment variable (all caps)

export interface ParsedTemplate {
  original: string;
  placeholders: Placeholder[];
  hasAutoGeneratedFields: boolean;
}

export interface PlaceholderValues {
  [key: string]: string;
}

export interface ResolvedTemplate {
  xml: string;
  generatedIds: Record<string, string>;  // Maps placeholder name to generated ID
}
```

**Verification:**
- Types compile without errors

---

### 3. Implement Placeholder Parser
**Priority:** 🔴 CRITICAL  
**Estimate:** 3-4 hours

**Description:**  
Create a utility module to parse and resolve placeholders in templates.

**Tasks:**
- [x] Create `src/main/placeholderParser.ts`
- [x] Implement `parsePlaceholders()` function
- [x] Implement `resolvePlaceholders()` function
- [x] Implement `generateUniqueId()` function
- [x] Add unit tests

**Notes:**
- User-entered values can request an auto-generated, labelled ID using the pattern `${id-label}`; the resolver generates an ID, stores it under `label`, and replaces the placeholder with that value for later assertions/correlation.

**New File - `src/main/placeholderParser.ts`:**
```typescript
import type { 
  Placeholder, 
  PlaceholderType, 
  ParsedTemplate, 
  PlaceholderValues,
  ResolvedTemplate 
} from '../types/placeholder';

// Regex to match {{placeholder}} patterns
const PLACEHOLDER_REGEX = /\{\{([^}]+)\}\}/g;

/**
 * Determines the type of a placeholder based on its name
 */
function getPlaceholderType(name: string): PlaceholderType {
  if (name.startsWith('$id')) {
    return 'id';
  }
  if (name === '$timestamp') {
    return 'timestamp';
  }
  if (name === name.toUpperCase() && /^[A-Z_]+$/.test(name)) {
    return 'env';
  }
  return 'user';
}

/**
 * Parse a template string and extract all placeholders
 */
export function parsePlaceholders(template: string): ParsedTemplate {
  const placeholders: Placeholder[] = [];
  let match: RegExpExecArray | null;
  let hasAutoGeneratedFields = false;

  // Reset regex state
  PLACEHOLDER_REGEX.lastIndex = 0;

  while ((match = PLACEHOLDER_REGEX.exec(template)) !== null) {
    const name = match[1].trim();
    const type = getPlaceholderType(name);
    
    if (type === 'id' || type === 'timestamp') {
      hasAutoGeneratedFields = true;
    }

    placeholders.push({
      name,
      fullMatch: match[0],
      type,
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return {
    original: template,
    placeholders,
    hasAutoGeneratedFields,
  };
}

/**
 * Generate a unique ID for {{$id}} placeholders
 */
export function generateUniqueId(prefix: string = 'virt'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Generate a timestamp for {{$timestamp}} placeholders
 */
export function generateTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Resolve all placeholders in a template with provided values
 */
export function resolvePlaceholders(
  template: string,
  values: PlaceholderValues,
  autoGenerate: boolean = true
): ResolvedTemplate {
  const parsed = parsePlaceholders(template);
  const generatedIds: Record<string, string> = {};
  let result = template;

  // Process placeholders in reverse order to maintain correct indices
  const sortedPlaceholders = [...parsed.placeholders].sort(
    (a, b) => b.startIndex - a.startIndex
  );

  for (const placeholder of sortedPlaceholders) {
    let value: string;

    switch (placeholder.type) {
      case 'id':
        if (autoGenerate) {
          // Check if we already generated this ID (for multiple uses of same placeholder)
          if (!generatedIds[placeholder.name]) {
            generatedIds[placeholder.name] = generateUniqueId();
          }
          value = generatedIds[placeholder.name];
        } else {
          value = values[placeholder.name] || placeholder.fullMatch;
        }
        break;

      case 'timestamp':
        value = autoGenerate ? generateTimestamp() : (values[placeholder.name] || placeholder.fullMatch);
        break;

      case 'env':
        value = process.env[placeholder.name] || values[placeholder.name] || '';
        break;

      case 'user':
      default:
        value = values[placeholder.name] || placeholder.fullMatch;
        break;
    }

    result = result.slice(0, placeholder.startIndex) + value + result.slice(placeholder.endIndex);
  }

  return {
    xml: result,
    generatedIds,
  };
}

/**
 * Get list of user-input placeholders (excluding auto-generated ones)
 */
export function getUserPlaceholders(template: string): Placeholder[] {
  const parsed = parsePlaceholders(template);
  return parsed.placeholders.filter(p => p.type === 'user');
}

/**
 * Validate that all required placeholders have values
 */
export function validatePlaceholders(
  template: string, 
  values: PlaceholderValues
): { valid: boolean; missing: string[] } {
  const userPlaceholders = getUserPlaceholders(template);
  const missing = userPlaceholders
    .filter(p => !values[p.name] || values[p.name].trim() === '')
    .map(p => p.name);

  return {
    valid: missing.length === 0,
    missing,
  };
}
```

**Verification:**
- Can parse `{{name}}` placeholders
- Can parse `{{$id}}` placeholders
- Can parse `{{$timestamp}}` placeholders
- Can parse `{{ENV_VAR}}` placeholders
- `resolvePlaceholders()` replaces all placeholders with values
- `{{$id}}` generates unique IDs
- Same `{{$id}}` placeholder used multiple times gets same ID

---

### 4. Create Placeholder Input Fields Component
**Priority:** 🔴 CRITICAL  
**Estimate:** 4-5 hours

**Description:**  
Create a React component that automatically renders input fields for each placeholder found in a template.

**Tasks:**
- [x] Create placeholder field rendering (implemented inline in `App.tsx` instead of a separate component)
- [x] Parse template text to find placeholders (single-brace supported)
- [x] Render input field for each user placeholder
- [x] Show guidance for auto-generated IDs via `${id-label}` tokens
- [x] Handle value changes
- [x] Style inputs consistently (reusing existing form styles)

**New File - `src/renderer/components/PlaceholderFields.tsx`:**
```tsx
import React, { useState, useEffect, useMemo } from 'react';
import type { Placeholder, PlaceholderValues } from '../../types/placeholder';

**Notes on implementation:**
- Implemented directly inside `App.tsx` using the shared parser; supports `{placeholder}` and `${id-label}` alias tokens for any field.
- Reuses existing form styles; no separate component/CSS file was added.

**Verification:**
- Placeholder-driven inputs render for placeholders in the stanza text.
- Alias tokens `${id-label}` are hinted and resolve to generated IDs at send time.
- Values update correctly; duplicate placeholders are de-duplicated in the parameter list.

.placeholder-fields-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.placeholder-fields-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.placeholder-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.placeholder-field label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.placeholder-auto-badge {
  font-size: 10px;
  padding: 2px 6px;
  background: var(--accent-color);
  color: white;
  border-radius: 4px;
  font-weight: 500;
}

.placeholder-input {
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 13px;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.placeholder-input:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px rgba(var(--accent-rgb), 0.2);
}

.placeholder-input-readonly {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  cursor: not-allowed;
  font-family: monospace;
}
```

**Verification:**
- Component renders input fields for `{{name}}` placeholders
- Component shows read-only field for `{{$id}}` with generated value
- Values update correctly when typing
- Duplicate placeholders only show one field

---

### 5. Integrate Placeholder Fields into Stanza Editor
**Priority:** 🔴 CRITICAL  
**Estimate:** 2-3 hours

**Description:**  
Integrate the PlaceholderFields component into the existing stanza editor in App.tsx.

**Tasks:**
- [x] Import and render placeholder fields (implemented inline in `App.tsx`)
- [x] Add placeholder values state
- [x] Show placeholder inputs above the stanza textarea when text contains placeholders
- [x] Resolve placeholders before sending stanza (supports `{}` and `${id-label}`)
- [x] Track generated IDs for response correlation

**Files to Modify:**
- `src/renderer/App.tsx`

**Notes on implementation:**
- Implemented within `App.tsx` (no separate component), using the shared placeholder parser.
- Inputs render whenever the stanza text contains placeholders; works for both loaded templates and freeform text.
- Resolution happens at send time; `${id-label}` is honored for any field and tracked for later correlation.

**Verification:**
- Placeholder inputs appear for `{placeholders}` in the editor.
- Values substitute correctly on send; alias-generated IDs are stored.

---

### 6. Create Composition Store
**Priority:** 🔴 CRITICAL  
**Estimate:** 3-4 hours

**Description:**  
Create a storage module for Compositions, similar to accountStore and templateStore.

**Tasks:**
- [x] Create `src/main/compositionStore.ts`
- [x] Implement CRUD operations
- [x] Save to `compositions.json` file
- [x] Add IPC handlers in main.ts

**New File - `src/main/compositionStore.ts`:**
```typescript
import fs from 'fs';
import path from 'path';
import type { Composition } from '../types/composition';

const compositionsFile: string = path.join(__dirname, '../../compositions.json');

export function loadCompositions(): Composition[] {
  try {
    if (fs.existsSync(compositionsFile)) {
      const data = fs.readFileSync(compositionsFile, 'utf-8');
      const parsed = JSON.parse(data);
      return parsed.compositions || [];
    }
  } catch (error) {
    console.error('Error loading compositions:', error);
  }
  return [];
}

export function saveCompositions(compositions: Composition[]): void {
  try {
    fs.writeFileSync(
      compositionsFile, 
      JSON.stringify({ compositions }, null, 2)
    );
  } catch (error) {
    console.error('Error saving compositions:', error);
  }
}

export function getComposition(compositionId: string): Composition | null {
  const compositions = loadCompositions();
  return compositions.find(p => p.id === compositionId) || null;
}

export function addComposition(composition: Composition): void {
  const compositions = loadCompositions();
  const existingIndex = compositions.findIndex(p => p.id === composition.id);
  
  if (existingIndex >= 0) {
    compositions[existingIndex] = {
      ...composition,
      updated: new Date().toISOString(),
    };
  } else {
    compositions.push({
      ...composition,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    });
  }
  
  saveCompositions(compositions);
}

export function deleteComposition(compositionId: string): void {
  const compositions = loadCompositions();
  const filtered = compositions.filter(p => p.id !== compositionId);
  saveCompositions(filtered);
}

export function exportComposition(compositionId: string, filePath: string): boolean {
  try {
    const composition = getComposition(compositionId);
    if (!composition) {
      return false;
    }
    fs.writeFileSync(filePath, JSON.stringify(composition, null, 2));
    return true;
  } catch (error) {
    console.error('Error exporting composition:', error);
    return false;
  }
}

export function importComposition(filePath: string): Composition | null {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    const composition = JSON.parse(data) as Composition;
    
    // Generate new ID to avoid conflicts
    composition.id = `perf_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    composition.created = new Date().toISOString();
    composition.updated = new Date().toISOString();
    
    addComposition(composition);
    return composition;
  } catch (error) {
    console.error('Error importing composition:', error);
    return null;
  }
}
```

**Add IPC handlers to `src/main/main.ts`:**
```typescript
import {
  loadCompositions,
  getComposition,
  addComposition,
  deleteComposition,
  exportComposition,
  importComposition,
} from './compositionStore';

// Composition IPC handlers
ipcMain.handle('load-compositions', async (): Promise<Composition[]> => {
  return loadCompositions();
});

ipcMain.handle('get-composition', async (_event, compositionId: string): Promise<Composition | null> => {
  return getComposition(compositionId);
});

ipcMain.handle('save-composition', async (_event, composition: Composition): Promise<{ success: boolean }> => {
  addComposition(composition);
  return { success: true };
});

ipcMain.handle('delete-composition', async (_event, compositionId: string): Promise<{ success: boolean }> => {
  deleteComposition(compositionId);
  return { success: true };
});

ipcMain.handle('export-composition', async (_event, compositionId: string, filePath: string): Promise<{ success: boolean }> => {
  const success = exportComposition(compositionId, filePath);
  return { success };
});

ipcMain.handle('import-composition', async (_event, filePath: string): Promise<{ success: boolean; composition?: Composition }> => {
  const composition = importComposition(filePath);
  return { success: !!composition, composition: composition || undefined };
});
```

**Update preload.ts:**
```typescript
// Add to VirtuosoAPI interface and implementation
loadCompositions: () => ipcRenderer.invoke('load-compositions'),
getComposition: (compositionId: string) => ipcRenderer.invoke('get-composition', compositionId),
saveComposition: (composition: unknown) => ipcRenderer.invoke('save-composition', composition),
deleteComposition: (compositionId: string) => ipcRenderer.invoke('delete-composition', compositionId),
exportComposition: (compositionId: string, filePath: string) => ipcRenderer.invoke('export-composition', compositionId, filePath),
importComposition: (filePath: string) => ipcRenderer.invoke('import-composition', filePath),
```

**Verification:**
- Can save a Composition
- Can load all Compositions
- Can get a single Composition
- Can delete a Composition
- Can export to file
- Can import from file

**Notes:**
- Backend + IPC implemented and covered by unit tests (`src/main/__tests__/compositionStore.test.ts`); renderer/UI wiring is not yet implemented, so the feature is not exposed in the app.

---

### 7. Create Composer State Hook
**Priority:** 🔴 CRITICAL  
**Estimate:** 4-5 hours

**Description:**  
Create a React hook to manage Composer state (recording mode, captured stanzas, etc.).

**Tasks:**
- [x] Create `src/renderer/hooks/useComposer.ts`
- [x] Implement start/stop composing
- [x] Capture actions as stanzas
- [x] Generate Composition from captured stanzas
- [x] Handle account references

**Notes on implementation:**
- Implemented with a reducer-based hook in `src/renderer/hooks/useComposer.ts` and pure helpers for ID generation and composition building.
- Unit tests added at `src/renderer/hooks/__tests__/useComposer.test.ts` covering start/stop, stanza capture, account tracking, and composition generation.

**Verification:**
- Hook tracks composing state
- Can start/stop/cancel composing
- Captures connect actions
- Captures disconnect actions
- Captures send actions
- Generates valid Composition object

---

### 8. Create Compositions Sidebar Component
**Priority:** 🔴 CRITICAL  
**Estimate:** 6-8 hours

**Description:**  
Create the right sidebar UI for Compositions (list, compose button, recording state).

**Tasks:**
- [ ] Create `src/renderer/components/compositions/CompositionsSidebar.tsx`
- [ ] Create `src/renderer/components/compositions/CompositionList.tsx`
- [ ] Create `src/renderer/components/compositions/ComposerPanel.tsx`
- [ ] Create `src/renderer/components/compositions/StanzaItem.tsx`
- [ ] Add styles

**New File - `src/renderer/components/compositions/CompositionsSidebar.tsx`:**
```tsx
import React, { useState, useEffect } from 'react';
import { CompositionList } from './CompositionList';
import { ComposerPanel } from './ComposerPanel';
import type { Composition, Stanza } from '../../../types/composition';

interface CompositionsSidebarProps {
  isComposing: boolean;
  composedStanzas: Stanza[];
  onStartComposing: () => void;
  onStopComposing: () => void;
  onCancelComposing: () => void;
  onPlayComposition: (composition: Composition) => void;
  onEditComposition: (composition: Composition) => void;
  onDeleteComposition: (compositionId: string) => void;
}

export function CompositionsSidebar({
  isComposing,
  composedStanzas,
  onStartComposing,
  onStopComposing,
  onCancelComposing,
  onPlayComposition,
  onEditComposition,
  onDeleteComposition,
}: CompositionsSidebarProps): JSX.Element {
  const [compositions, setCompositions] = useState<Composition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCompositions();
  }, []);

  const loadCompositions = async () => {
    setLoading(true);
    try {
      const loaded = await window.virtuoso.loadCompositions();
      setCompositions(loaded as Composition[]);
    } catch (error) {
      console.error('Failed to load compositions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (compositionId: string) => {
    await window.virtuoso.deleteComposition(compositionId);
    onDeleteComposition(compositionId);
    loadCompositions();
  };

  return (
    <div className="compositions-sidebar">
      <div className="compositions-sidebar-header">
        <h2>Compositions</h2>
        {!isComposing && (
          <button 
            className="compose-button"
            onClick={onStartComposing}
          >
            + Compose New
          </button>
        )}
      </div>

      {isComposing ? (
        <ComposerPanel
          stanzas={composedStanzas}
          onStop={onStopComposing}
          onCancel={onCancelComposing}
        />
      ) : (
        <CompositionList
          compositions={compositions}
          loading={loading}
          onPlay={onPlayComposition}
          onEdit={onEditComposition}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
```

**New File - `src/renderer/components/compositions/CompositionList.tsx`:**
```tsx
import React from 'react';
import type { Composition } from '../../../types/composition';

interface CompositionListProps {
  compositions: Composition[];
  loading: boolean;
  onPlay: (composition: Composition) => void;
  onEdit: (composition: Composition) => void;
  onDelete: (compositionId: string) => void;
}

export function CompositionList({
  compositions,
  loading,
  onPlay,
  onEdit,
  onDelete,
}: CompositionListProps): JSX.Element {
  if (loading) {
    return <div className="composition-list-loading">Loading...</div>;
  }

  if (compositions.length === 0) {
    return (
      <div className="composition-list-empty">
        <p>No compositions yet.</p>
        <p className="hint">Click "Compose New" to create one.</p>
      </div>
    );
  }

  return (
    <div className="composition-list">
      {compositions.map((composition) => (
        <div key={composition.id} className="composition-item">
          <div className="composition-item-info">
            <span className="composition-item-name">{composition.name}</span>
            <span className="composition-item-meta">
              {composition.stanzas.length} stanzas
            </span>
          </div>
          <div className="composition-item-actions">
            <button 
              className="btn-icon" 
              onClick={() => onPlay(composition)}
              title="Play"
            >
              ▶
            </button>
            <button 
              className="btn-icon" 
              onClick={() => onEdit(composition)}
              title="Edit"
            >
              ✎
            </button>
            <button 
              className="btn-icon btn-danger" 
              onClick={() => onDelete(composition.id)}
              title="Delete"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

**New File - `src/renderer/components/compositions/ComposerPanel.tsx`:**
```tsx
import React from 'react';
import { StanzaItem } from './StanzaItem';
import type { Stanza } from '../../../types/composition';

interface ComposerPanelProps {
  stanzas: Stanza[];
  onStop: () => void;
  onCancel: () => void;
}

export function ComposerPanel({
  stanzas,
  onStop,
  onCancel,
}: ComposerPanelProps): JSX.Element {
  return (
    <div className="composer-panel">
      <div className="composer-indicator">
        <span className="recording-dot"></span>
        <span>Composing...</span>
      </div>

      <div className="composer-stanzas">
        {stanzas.length === 0 ? (
          <div className="composer-empty">
            <p>Perform actions to capture them.</p>
            <p className="hint">Connect, send stanzas, add assertions...</p>
          </div>
        ) : (
          stanzas.map((stanza, index) => (
            <StanzaItem 
              key={stanza.id} 
              stanza={stanza} 
              index={index + 1}
            />
          ))
        )}
      </div>

      <div className="composer-actions">
        <button 
          className="btn-primary"
          onClick={onStop}
          disabled={stanzas.length === 0}
        >
          Stop & Save
        </button>
        <button 
          className="btn-secondary"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
```

**New File - `src/renderer/components/compositions/StanzaItem.tsx`:**
```tsx
import React from 'react';
import type { Stanza } from '../../../types/composition';

interface StanzaItemProps {
  stanza: Stanza;
  index: number;
  status?: 'pending' | 'running' | 'passed' | 'failed';
}

const TYPE_ICONS: Record<string, string> = {
  connect: '🔌',
  disconnect: '⏏',
  send: '📤',
  cue: '⏳',
  assert: '✓',
};

export function StanzaItem({ 
  stanza, 
  index,
  status = 'pending',
}: StanzaItemProps): JSX.Element {
  const icon = TYPE_ICONS[stanza.type] || '•';
  
  return (
    <div className={`stanza-item stanza-item-${status}`}>
      <span className="stanza-index">{index}</span>
      <span className="stanza-icon">{icon}</span>
      <span className="stanza-description">{stanza.description}</span>
      {status === 'passed' && <span className="stanza-status">✓</span>}
      {status === 'failed' && <span className="stanza-status">✗</span>}
    </div>
  );
}
```

**Verification:**
- Sidebar renders on the right side
- "Compose New" button starts composing
- Composing state shows recording indicator
- Captured stanzas appear in real-time
- Stop saves the Composition
- Cancel discards and exits
- Composition list shows saved Compositions
- Can play/edit/delete Compositions

---

### 9. Integrate Composer into Main App
**Priority:** 🔴 CRITICAL  
**Estimate:** 4-5 hours

**Description:**  
Wire up the Composer to capture actions from the main App.tsx.

**Tasks:**
- [ ] Add useComposer hook to App.tsx
- [ ] Pass composer callbacks to action handlers
- [ ] Add CompositionsSidebar to layout
- [ ] Update CSS for three-column layout
- [ ] Save Composition when composing stops

**Verification:**
- Three-column layout renders correctly
- Clicking connect while composing captures it
- Clicking disconnect while composing captures it
- Sending stanza while composing captures it
- Stopping saves Composition to list

---

### 10. Implement Basic Playback
**Priority:** 🔴 CRITICAL  
**Estimate:** 6-8 hours

**Description:**  
Create a basic playback engine that executes Stanzas sequentially.

**Tasks:**
- [ ] Create `src/main/compositionRunner.ts`
- [ ] Implement sequential stanza execution
- [ ] Handle connect/disconnect/send stanzas
- [ ] Add IPC handlers for playback
- [ ] Create basic playback UI

**New File - `src/main/compositionRunner.ts`:**
```typescript
import type { 
  Composition, 
  Stanza, 
  PlaybackResult, 
  StanzaResult 
} from '../types/composition';
import { connectAccount, disconnectAccount, sendStanza } from './xmppManager';
import { loadAccounts } from './accountStore';
import type { Account } from '../types/account';

interface RunnerCallbacks {
  onStanzaStart: (stanzaId: string) => void;
  onStanzaComplete: (result: StanzaResult) => void;
  onComplete: (result: PlaybackResult) => void;
  onError: (error: Error) => void;
}

export async function runComposition(
  composition: Composition,
  callbacks: RunnerCallbacks
): Promise<PlaybackResult> {
  const startTime = new Date().toISOString();
  const stanzaResults: StanzaResult[] = [];
  const accounts = loadAccounts();
  
  // Map composition account aliases to actual accounts
  const accountMap = new Map<string, Account>();
  for (const ref of composition.accounts) {
    const account = accounts.find(a => a.jid === ref.jid || a.name === ref.alias);
    if (account) {
      accountMap.set(ref.alias, account);
    }
  }

  let hasFailure = false;

  for (const stanza of composition.stanzas) {
    callbacks.onStanzaStart(stanza.id);
    const stanzaStart = Date.now();

    try {
      const result = await executeStanza(stanza, accountMap, callbacks);
      stanzaResults.push(result);
      
      if (result.status === 'failed' || result.status === 'error') {
        hasFailure = true;
      }
      
      callbacks.onStanzaComplete(result);
    } catch (error) {
      const errorResult: StanzaResult = {
        stanzaId: stanza.id,
        status: 'error',
        duration: Date.now() - stanzaStart,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
      stanzaResults.push(errorResult);
      hasFailure = true;
      callbacks.onStanzaComplete(errorResult);
    }
  }

  const endTime = new Date().toISOString();
  const result: PlaybackResult = {
    compositionId: composition.id,
    status: hasFailure ? 'failed' : 'passed',
    startTime,
    endTime,
    duration: Date.now() - new Date(startTime).getTime(),
    stanzaResults,
    summary: {
      total: stanzaResults.length,
      passed: stanzaResults.filter(r => r.status === 'passed').length,
      failed: stanzaResults.filter(r => r.status === 'failed').length,
      skipped: stanzaResults.filter(r => r.status === 'skipped').length,
    },
  };

  callbacks.onComplete(result);
  return result;
}

async function executeStanza(
  stanza: Stanza,
  accountMap: Map<string, Account>,
  callbacks: RunnerCallbacks
): Promise<StanzaResult> {
  const start = Date.now();
  const account = accountMap.get(stanza.accountAlias);

  if (!account && stanza.type !== 'assert') {
    return {
      stanzaId: stanza.id,
      status: 'error',
      duration: Date.now() - start,
      error: { message: `Account not found: ${stanza.accountAlias}` },
    };
  }

  switch (stanza.type) {
    case 'connect':
      await connectAccount(account!, (_accId, _xml) => {
        // Stanza received during playback - could be used for cues
      });
      return {
        stanzaId: stanza.id,
        status: 'passed',
        duration: Date.now() - start,
      };

    case 'disconnect':
      await disconnectAccount(account!.id);
      return {
        stanzaId: stanza.id,
        status: 'passed',
        duration: Date.now() - start,
      };

    case 'send':
      if (stanza.data.type === 'send') {
        await sendStanza(account!.id, stanza.data.xml);
        return {
          stanzaId: stanza.id,
          status: 'passed',
          duration: Date.now() - start,
          sentXml: stanza.data.xml,
        };
      }
      break;

    case 'cue':
      // TODO: Implement cue waiting in Sprint 2
      return {
        stanzaId: stanza.id,
        status: 'passed', // For now, just pass through
        duration: Date.now() - start,
      };

    case 'assert':
      // TODO: Implement assertions in Sprint 2
      return {
        stanzaId: stanza.id,
        status: 'passed', // For now, just pass through
        duration: Date.now() - start,
      };
  }

  return {
    stanzaId: stanza.id,
    status: 'error',
    duration: Date.now() - start,
    error: { message: `Unknown stanza type: ${stanza.type}` },
  };
}
```

**Verification:**
- Can play a Composition
- Connect stanzas work
- Disconnect stanzas work
- Send stanzas work
- Results displayed after playback

---

## 📊 Sprint Summary

| Task | Priority | Estimate | Dependencies |
|------|----------|----------|--------------|
| Composition type definitions | 🔴 CRITICAL | 2-3 hours | Sprint 0 |
| Placeholder type definitions | 🔴 CRITICAL | 1 hour | Sprint 0 |
| Placeholder parser | 🔴 CRITICAL | 3-4 hours | Types |
| PlaceholderFields component | 🔴 CRITICAL | 4-5 hours | Parser |
| Integrate into stanza editor | 🔴 CRITICAL | 2-3 hours | Component |
| Composition store | 🔴 CRITICAL | 3-4 hours | Types |
| useComposer hook | 🔴 CRITICAL | 4-5 hours | Types |
| Compositions sidebar | 🔴 CRITICAL | 6-8 hours | Hook, Store |
| Integrate composer | 🔴 CRITICAL | 4-5 hours | Sidebar |
| Basic playback | 🔴 CRITICAL | 6-8 hours | Store, Runner |

**Total Estimate: 36-46 hours (2-3 weeks at 15-20 hours/week)**

---

## ✅ Definition of Done

- [ ] Template placeholders work (`{{name}}`, `{{$id}}`)
- [ ] Placeholder fields auto-generate in UI
- [ ] Can start/stop composing
- [ ] Actions captured during composing
- [ ] Compositions saved to JSON
- [ ] Composition list displays in sidebar
- [ ] Basic playback executes stanzas
- [ ] All TypeScript compiles without errors
- [ ] Manual testing passes
