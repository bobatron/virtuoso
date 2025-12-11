# Sprint 2: Cues, Assertions & Response Correlation (2 weeks)

## 🎯 Sprint Goal

Implement the Cue system for waiting on responses, assertions for validation, and response correlation using `{{$id}}` tracking. This enables reliable, non-flaky Performances.

## 📋 Success Criteria

- [ ] Cues pause playback until matching response received
- [ ] ID-based response correlation works (`{{$id}}` tracking)
- [ ] Click on response to add Cue or assertion
- [ ] Contains assertions work
- [ ] Equals assertions work
- [ ] XPath assertions work (basic)
- [ ] Regex assertions work
- [ ] Can edit existing Performances
- [ ] Can import Performances from JSON file

## 📦 Prerequisites

- Sprint 1 completed
- Basic Composer and playback working
- Performance store implemented

---

## 🔨 Work Items

### 1. Implement Response Tracking
**Priority:** 🔴 CRITICAL  
**Estimate:** 4-5 hours

**Description:**  
Track all responses received during playback and composing to enable Cues and assertions.

**Tasks:**
- [ ] Create response buffer in performance runner
- [ ] Track which account received each response
- [ ] Store timestamp for each response
- [ ] Enable correlation by stanza ID attribute

**New File - `src/main/responseTracker.ts`:**
```typescript
import type { Element } from 'ltx';

export interface TrackedResponse {
  accountId: string;
  xml: string;
  timestamp: number;
  stanzaId?: string;  // The 'id' attribute if present
  stanzaType?: string; // message, presence, iq
}

class ResponseTracker {
  private responses: Map<string, TrackedResponse[]> = new Map();
  private listeners: Map<string, Set<(response: TrackedResponse) => void>> = new Map();

  /**
   * Track a received response
   */
  track(accountId: string, xml: string): TrackedResponse {
    const response: TrackedResponse = {
      accountId,
      xml,
      timestamp: Date.now(),
      stanzaId: this.extractId(xml),
      stanzaType: this.extractType(xml),
    };

    if (!this.responses.has(accountId)) {
      this.responses.set(accountId, []);
    }
    this.responses.get(accountId)!.push(response);

    // Notify listeners
    const accountListeners = this.listeners.get(accountId);
    if (accountListeners) {
      accountListeners.forEach(listener => listener(response));
    }

    // Also notify global listeners
    const globalListeners = this.listeners.get('*');
    if (globalListeners) {
      globalListeners.forEach(listener => listener(response));
    }

    return response;
  }

  /**
   * Extract the 'id' attribute from an XML stanza
   */
  private extractId(xml: string): string | undefined {
    const match = xml.match(/\bid=['"]([^'"]+)['"]/);
    return match ? match[1] : undefined;
  }

  /**
   * Extract the stanza type (message, presence, iq)
   */
  private extractType(xml: string): string | undefined {
    const match = xml.match(/^<(\w+)/);
    return match ? match[1] : undefined;
  }

  /**
   * Wait for a response matching the given criteria
   */
  waitFor(
    accountId: string,
    matcher: (response: TrackedResponse) => boolean,
    timeout: number = 10000
  ): Promise<TrackedResponse> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.removeListener(accountId, listener);
        reject(new Error(`Timeout waiting for response (${timeout}ms)`));
      }, timeout);

      const listener = (response: TrackedResponse) => {
        if (matcher(response)) {
          clearTimeout(timeoutId);
          this.removeListener(accountId, listener);
          resolve(response);
        }
      };

      // Check existing responses first
      const existing = this.responses.get(accountId) || [];
      for (const response of existing) {
        if (matcher(response)) {
          clearTimeout(timeoutId);
          resolve(response);
          return;
        }
      }

      // Listen for new responses
      this.addListener(accountId, listener);
    });
  }

  /**
   * Wait for a response with a specific ID
   */
  waitForId(
    accountId: string,
    stanzaId: string,
    timeout: number = 10000
  ): Promise<TrackedResponse> {
    return this.waitFor(
      accountId,
      (response) => response.stanzaId === stanzaId,
      timeout
    );
  }

  /**
   * Wait for a response containing specific text
   */
  waitForContains(
    accountId: string,
    text: string,
    timeout: number = 10000
  ): Promise<TrackedResponse> {
    return this.waitFor(
      accountId,
      (response) => response.xml.includes(text),
      timeout
    );
  }

  /**
   * Wait for a response matching a regex
   */
  waitForRegex(
    accountId: string,
    pattern: string,
    timeout: number = 10000
  ): Promise<TrackedResponse> {
    const regex = new RegExp(pattern);
    return this.waitFor(
      accountId,
      (response) => regex.test(response.xml),
      timeout
    );
  }

  /**
   * Add a listener for responses
   */
  addListener(accountId: string, listener: (response: TrackedResponse) => void): void {
    if (!this.listeners.has(accountId)) {
      this.listeners.set(accountId, new Set());
    }
    this.listeners.get(accountId)!.add(listener);
  }

  /**
   * Remove a listener
   */
  removeListener(accountId: string, listener: (response: TrackedResponse) => void): void {
    const listeners = this.listeners.get(accountId);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * Get all responses for an account
   */
  getResponses(accountId: string): TrackedResponse[] {
    return this.responses.get(accountId) || [];
  }

  /**
   * Clear responses for an account or all accounts
   */
  clear(accountId?: string): void {
    if (accountId) {
      this.responses.delete(accountId);
    } else {
      this.responses.clear();
    }
  }
}

// Singleton instance
export const responseTracker = new ResponseTracker();
```

**Verification:**
- Responses are tracked with timestamps
- ID extraction works for stanzas with id attribute
- `waitForId()` resolves when matching response arrives
- `waitForContains()` works
- Timeout triggers if no match

---

### 2. Implement Cue Execution in Performance Runner
**Priority:** 🔴 CRITICAL  
**Estimate:** 4-5 hours

**Description:**  
Update the performance runner to execute Cues by waiting for matching responses.

**Tasks:**
- [ ] Integrate responseTracker with xmppManager
- [ ] Implement cue execution in performanceRunner
- [ ] Support all match types (contains, regex, id, xpath)
- [ ] Handle timeouts gracefully

**Update `src/main/performanceRunner.ts`:**
```typescript
import { responseTracker, type TrackedResponse } from './responseTracker';

// In executeStanza function, update the 'cue' case:
case 'cue':
  if (stanza.data.type === 'cue') {
    const cueData = stanza.data;
    
    try {
      let response: TrackedResponse;
      
      switch (cueData.matchType) {
        case 'id':
          response = await responseTracker.waitForId(
            account!.id,
            cueData.correlatedId || cueData.matchExpression,
            cueData.timeout
          );
          break;
          
        case 'contains':
          response = await responseTracker.waitForContains(
            account!.id,
            cueData.matchExpression,
            cueData.timeout
          );
          break;
          
        case 'regex':
          response = await responseTracker.waitForRegex(
            account!.id,
            cueData.matchExpression,
            cueData.timeout
          );
          break;
          
        case 'xpath':
          // Basic XPath support - just check if expression appears
          response = await responseTracker.waitFor(
            account!.id,
            (r) => evaluateXPath(r.xml, cueData.matchExpression),
            cueData.timeout
          );
          break;
          
        default:
          throw new Error(`Unknown match type: ${cueData.matchType}`);
      }
      
      return {
        stanzaId: stanza.id,
        status: 'passed',
        duration: Date.now() - start,
        receivedXml: response.xml,
      };
    } catch (error) {
      return {
        stanzaId: stanza.id,
        status: 'failed',
        duration: Date.now() - start,
        error: {
          message: error instanceof Error ? error.message : 'Cue failed',
        },
      };
    }
  }
  break;
```

**Add XPath evaluation helper:**
```typescript
import { DOMParser, XPathResult } from '@xmldom/xmldom';
import xpath from 'xpath';

function evaluateXPath(xml: string, expression: string): boolean {
  try {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const result = xpath.select(expression, doc);
    
    if (Array.isArray(result)) {
      return result.length > 0;
    }
    return !!result;
  } catch {
    return false;
  }
}
```

**Add dependencies:**
```bash
npm install @xmldom/xmldom xpath
npm install -D @types/xpath
```

**Verification:**
- Cue with `id` match waits for correct response
- Cue with `contains` match works
- Cue with `regex` match works
- Cue with `xpath` match works
- Timeout produces failed result, not crash

---

### 3. Implement Assertion Execution
**Priority:** 🔴 CRITICAL  
**Estimate:** 4-5 hours

**Description:**  
Implement assertion evaluation against received responses.

**Tasks:**
- [ ] Create `src/main/assertionEngine.ts`
- [ ] Implement contains assertion
- [ ] Implement equals assertion
- [ ] Implement regex assertion
- [ ] Implement xpath assertion
- [ ] Integrate with performance runner

**New File - `src/main/assertionEngine.ts`:**
```typescript
import { DOMParser } from '@xmldom/xmldom';
import xpath from 'xpath';
import type { AssertData, AssertionResult, Assertion } from '../types/performance';

export interface AssertionContext {
  xml: string;
  accountId: string;
}

/**
 * Evaluate an assertion against the given context
 */
export function evaluateAssertion(
  assertion: Assertion | AssertData,
  context: AssertionContext
): AssertionResult {
  const assertionType = 'assertionType' in assertion ? assertion.assertionType : assertion.type;
  
  try {
    switch (assertionType) {
      case 'contains':
        return evaluateContains(assertion, context);
      case 'equals':
        return evaluateEquals(assertion, context);
      case 'regex':
        return evaluateRegex(assertion, context);
      case 'xpath':
        return evaluateXPath(assertion, context);
      case 'exists':
        return evaluateExists(assertion, context);
      case 'count':
        return evaluateCount(assertion, context);
      default:
        return {
          assertionId: 'id' in assertion ? assertion.id : 'unknown',
          passed: false,
          error: `Unknown assertion type: ${assertionType}`,
        };
    }
  } catch (error) {
    return {
      assertionId: 'id' in assertion ? assertion.id : 'unknown',
      passed: false,
      error: error instanceof Error ? error.message : 'Assertion failed',
    };
  }
}

function evaluateContains(
  assertion: Assertion | AssertData,
  context: AssertionContext
): AssertionResult {
  const expression = assertion.expression;
  const passed = context.xml.includes(expression);
  const negate = 'negate' in assertion && assertion.negate;

  return {
    assertionId: 'id' in assertion ? assertion.id : 'inline',
    passed: negate ? !passed : passed,
    actual: passed ? 'Found' : 'Not found',
    expected: expression,
  };
}

function evaluateEquals(
  assertion: Assertion | AssertData,
  context: AssertionContext
): AssertionResult {
  const expected = 'expected' in assertion ? String(assertion.expected) : assertion.expression;
  const normalizedXml = context.xml.replace(/\s+/g, ' ').trim();
  const normalizedExpected = expected.replace(/\s+/g, ' ').trim();
  const passed = normalizedXml === normalizedExpected;
  const negate = 'negate' in assertion && assertion.negate;

  return {
    assertionId: 'id' in assertion ? assertion.id : 'inline',
    passed: negate ? !passed : passed,
    actual: context.xml.substring(0, 200) + (context.xml.length > 200 ? '...' : ''),
    expected: expected.substring(0, 200) + (expected.length > 200 ? '...' : ''),
  };
}

function evaluateRegex(
  assertion: Assertion | AssertData,
  context: AssertionContext
): AssertionResult {
  const pattern = assertion.expression;
  const regex = new RegExp(pattern);
  const match = regex.exec(context.xml);
  const passed = match !== null;
  const negate = 'negate' in assertion && assertion.negate;

  return {
    assertionId: 'id' in assertion ? assertion.id : 'inline',
    passed: negate ? !passed : passed,
    actual: match ? match[0] : 'No match',
    expected: pattern,
  };
}

function evaluateXPath(
  assertion: Assertion | AssertData,
  context: AssertionContext
): AssertionResult {
  const expression = assertion.expression;
  const expected = 'expected' in assertion ? assertion.expected : undefined;
  
  const doc = new DOMParser().parseFromString(context.xml, 'text/xml');
  const result = xpath.select(expression, doc);
  
  let actual: string;
  let passed: boolean;

  if (Array.isArray(result)) {
    if (result.length === 0) {
      actual = 'No nodes found';
      passed = false;
    } else if (expected !== undefined) {
      // Compare first result's text content with expected
      const firstNode = result[0];
      actual = 'textContent' in firstNode 
        ? (firstNode as { textContent: string }).textContent 
        : String(firstNode);
      passed = actual === String(expected);
    } else {
      actual = `${result.length} node(s) found`;
      passed = true;
    }
  } else {
    actual = String(result);
    passed = expected !== undefined ? actual === String(expected) : !!result;
  }

  const negate = 'negate' in assertion && assertion.negate;

  return {
    assertionId: 'id' in assertion ? assertion.id : 'inline',
    passed: negate ? !passed : passed,
    actual,
    expected: expected !== undefined ? String(expected) : 'Exists',
  };
}

function evaluateExists(
  assertion: Assertion | AssertData,
  context: AssertionContext
): AssertionResult {
  const expression = assertion.expression;
  const doc = new DOMParser().parseFromString(context.xml, 'text/xml');
  const result = xpath.select(expression, doc);
  const exists = Array.isArray(result) ? result.length > 0 : !!result;
  const negate = 'negate' in assertion && assertion.negate;

  return {
    assertionId: 'id' in assertion ? assertion.id : 'inline',
    passed: negate ? !exists : exists,
    actual: exists ? 'Exists' : 'Does not exist',
    expected: negate ? 'Does not exist' : 'Exists',
  };
}

function evaluateCount(
  assertion: Assertion | AssertData,
  context: AssertionContext
): AssertionResult {
  const expression = assertion.expression;
  const expected = 'expected' in assertion ? Number(assertion.expected) : 0;
  
  const doc = new DOMParser().parseFromString(context.xml, 'text/xml');
  const result = xpath.select(expression, doc);
  const count = Array.isArray(result) ? result.length : (result ? 1 : 0);
  const passed = count === expected;
  const negate = 'negate' in assertion && assertion.negate;

  return {
    assertionId: 'id' in assertion ? assertion.id : 'inline',
    passed: negate ? !passed : passed,
    actual: String(count),
    expected: String(expected),
  };
}

/**
 * Evaluate multiple assertions against a context
 */
export function evaluateAssertions(
  assertions: Assertion[],
  context: AssertionContext
): AssertionResult[] {
  return assertions.map(assertion => evaluateAssertion(assertion, context));
}
```

**Verification:**
- Contains assertion passes when text found
- Contains assertion fails when text not found
- Equals assertion handles whitespace normalization
- Regex assertion captures matches
- XPath assertion finds nodes
- Negate option inverts result

---

### 4. Add Response Context Menu (Click to Add Cue/Assert)
**Priority:** 🔴 CRITICAL  
**Estimate:** 5-6 hours

**Description:**  
When composing, allow users to click on a response to add a Cue or assertion.

**Tasks:**
- [ ] Create `src/renderer/components/ResponseActions.tsx`
- [ ] Show context menu on response click during composing
- [ ] "Wait for this response" option adds Cue
- [ ] "Assert this response" option opens assertion builder
- [ ] Add to Composer flow

**New File - `src/renderer/components/ResponseActions.tsx`:**
```tsx
import React, { useState } from 'react';

interface ResponseActionsProps {
  xml: string;
  accountId: string;
  isComposing: boolean;
  onAddCue: (matchType: string, matchExpression: string) => void;
  onAddAssertion: (assertionType: string, expression: string, expected?: string) => void;
  position: { x: number; y: number };
  onClose: () => void;
}

export function ResponseActions({
  xml,
  accountId,
  isComposing,
  onAddCue,
  onAddAssertion,
  position,
  onClose,
}: ResponseActionsProps): JSX.Element | null {
  const [mode, setMode] = useState<'menu' | 'cue' | 'assert'>('menu');
  const [matchType, setMatchType] = useState<string>('contains');
  const [expression, setExpression] = useState<string>('');
  const [expected, setExpected] = useState<string>('');

  if (!isComposing) return null;

  // Extract stanza ID if present
  const idMatch = xml.match(/\bid=['"]([^'"]+)['"]/);
  const stanzaId = idMatch ? idMatch[1] : null;

  const handleAddCue = () => {
    onAddCue(matchType, expression || (stanzaId && matchType === 'id' ? stanzaId : ''));
    onClose();
  };

  const handleAddAssertion = () => {
    onAddAssertion(matchType, expression, expected || undefined);
    onClose();
  };

  const handleQuickCueById = () => {
    if (stanzaId) {
      onAddCue('id', stanzaId);
      onClose();
    }
  };

  const handleQuickAssertContains = () => {
    // Use a snippet from the XML
    const snippet = xml.substring(0, 50);
    onAddAssertion('contains', snippet);
    onClose();
  };

  return (
    <div 
      className="response-actions-menu"
      style={{ top: position.y, left: position.x }}
    >
      {mode === 'menu' && (
        <>
          <div className="response-actions-header">Add to Performance</div>
          
          {stanzaId && (
            <button 
              className="response-action-item"
              onClick={handleQuickCueById}
            >
              ⏳ Wait for response with ID: {stanzaId}
            </button>
          )}
          
          <button 
            className="response-action-item"
            onClick={() => setMode('cue')}
          >
            ⏳ Wait for this response...
          </button>
          
          <button 
            className="response-action-item"
            onClick={handleQuickAssertContains}
          >
            ✓ Quick assert (contains)
          </button>
          
          <button 
            className="response-action-item"
            onClick={() => setMode('assert')}
          >
            ✓ Add assertion...
          </button>
          
          <button 
            className="response-action-item response-action-cancel"
            onClick={onClose}
          >
            Cancel
          </button>
        </>
      )}

      {mode === 'cue' && (
        <div className="response-action-form">
          <div className="response-actions-header">Add Cue (Wait Point)</div>
          
          <label>
            Match Type:
            <select 
              value={matchType} 
              onChange={(e) => setMatchType(e.target.value)}
            >
              <option value="id">By ID</option>
              <option value="contains">Contains text</option>
              <option value="regex">Regex pattern</option>
              <option value="xpath">XPath</option>
            </select>
          </label>
          
          <label>
            {matchType === 'id' ? 'Stanza ID:' : 'Expression:'}
            <input 
              type="text"
              value={expression || (matchType === 'id' && stanzaId ? stanzaId : '')}
              onChange={(e) => setExpression(e.target.value)}
              placeholder={matchType === 'id' ? 'e.g., abc123' : 'Enter match expression'}
            />
          </label>
          
          <div className="response-action-buttons">
            <button onClick={handleAddCue}>Add Cue</button>
            <button onClick={() => setMode('menu')}>Back</button>
          </div>
        </div>
      )}

      {mode === 'assert' && (
        <div className="response-action-form">
          <div className="response-actions-header">Add Assertion</div>
          
          <label>
            Assertion Type:
            <select 
              value={matchType} 
              onChange={(e) => setMatchType(e.target.value)}
            >
              <option value="contains">Contains</option>
              <option value="equals">Equals</option>
              <option value="regex">Regex</option>
              <option value="xpath">XPath</option>
            </select>
          </label>
          
          <label>
            Expression:
            <input 
              type="text"
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              placeholder="What to check for"
            />
          </label>
          
          {(matchType === 'xpath' || matchType === 'equals') && (
            <label>
              Expected Value:
              <input 
                type="text"
                value={expected}
                onChange={(e) => setExpected(e.target.value)}
                placeholder="Expected result"
              />
            </label>
          )}
          
          <div className="response-action-buttons">
            <button onClick={handleAddAssertion}>Add Assertion</button>
            <button onClick={() => setMode('menu')}>Back</button>
          </div>
        </div>
      )}
    </div>
  );
}
```

**CSS for ResponseActions:**
```css
.response-actions-menu {
  position: fixed;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 280px;
  z-index: 1000;
  padding: 8px 0;
}

.response-actions-header {
  padding: 8px 16px;
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 12px;
  text-transform: uppercase;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 4px;
}

.response-action-item {
  display: block;
  width: 100%;
  padding: 10px 16px;
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-primary);
}

.response-action-item:hover {
  background: var(--bg-secondary);
}

.response-action-cancel {
  color: var(--text-secondary);
  border-top: 1px solid var(--border-color);
  margin-top: 4px;
}

.response-action-form {
  padding: 12px 16px;
}

.response-action-form label {
  display: block;
  margin-bottom: 12px;
  font-size: 13px;
}

.response-action-form select,
.response-action-form input {
  display: block;
  width: 100%;
  margin-top: 4px;
  padding: 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 13px;
}

.response-action-buttons {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.response-action-buttons button {
  flex: 1;
  padding: 8px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
}
```

**Verification:**
- Context menu appears when clicking response during composing
- "Wait for this response" adds Cue
- Quick assert adds contains assertion
- Can customize match type and expression
- Menu closes on selection or cancel

---

### 5. Create Performance Editor
**Priority:** 🟡 HIGH  
**Estimate:** 6-8 hours

**Description:**  
Allow editing existing Performances (reorder stanzas, edit assertions, etc.).

**Tasks:**
- [ ] Create `src/renderer/components/performances/PerformanceEditor.tsx`
- [ ] Display stanza list with drag-to-reorder
- [ ] Edit stanza details
- [ ] Add/remove stanzas manually
- [ ] Edit Performance metadata (name, description)

**New File - `src/renderer/components/performances/PerformanceEditor.tsx`:**
```tsx
import React, { useState, useEffect } from 'react';
import type { Performance, Stanza } from '../../../types/performance';

interface PerformanceEditorProps {
  performance: Performance;
  onSave: (performance: Performance) => void;
  onCancel: () => void;
}

export function PerformanceEditor({
  performance,
  onSave,
  onCancel,
}: PerformanceEditorProps): JSX.Element {
  const [edited, setEdited] = useState<Performance>({ ...performance });
  const [selectedStanza, setSelectedStanza] = useState<Stanza | null>(null);

  const handleNameChange = (name: string) => {
    setEdited(prev => ({ ...prev, name }));
  };

  const handleDescriptionChange = (description: string) => {
    setEdited(prev => ({ ...prev, description }));
  };

  const handleDeleteStanza = (stanzaId: string) => {
    setEdited(prev => ({
      ...prev,
      stanzas: prev.stanzas.filter(s => s.id !== stanzaId),
    }));
  };

  const handleMoveStanza = (stanzaId: string, direction: 'up' | 'down') => {
    setEdited(prev => {
      const stanzas = [...prev.stanzas];
      const index = stanzas.findIndex(s => s.id === stanzaId);
      
      if (direction === 'up' && index > 0) {
        [stanzas[index - 1], stanzas[index]] = [stanzas[index], stanzas[index - 1]];
      } else if (direction === 'down' && index < stanzas.length - 1) {
        [stanzas[index], stanzas[index + 1]] = [stanzas[index + 1], stanzas[index]];
      }
      
      return { ...prev, stanzas };
    });
  };

  const handleSave = () => {
    onSave({
      ...edited,
      updated: new Date().toISOString(),
    });
  };

  return (
    <div className="performance-editor">
      <div className="performance-editor-header">
        <h2>Edit Performance</h2>
        <div className="performance-editor-actions">
          <button onClick={handleSave} className="btn-primary">
            Save
          </button>
          <button onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
        </div>
      </div>

      <div className="performance-editor-content">
        <div className="performance-editor-metadata">
          <label>
            Name:
            <input
              type="text"
              value={edited.name}
              onChange={(e) => handleNameChange(e.target.value)}
            />
          </label>
          <label>
            Description:
            <textarea
              value={edited.description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              rows={3}
            />
          </label>
        </div>

        <div className="performance-editor-stanzas">
          <h3>Stanzas ({edited.stanzas.length})</h3>
          
          {edited.stanzas.map((stanza, index) => (
            <div key={stanza.id} className="editor-stanza-item">
              <span className="stanza-number">{index + 1}</span>
              <span className="stanza-type">{stanza.type}</span>
              <span className="stanza-desc">{stanza.description}</span>
              
              <div className="stanza-controls">
                <button 
                  onClick={() => handleMoveStanza(stanza.id, 'up')}
                  disabled={index === 0}
                >
                  ↑
                </button>
                <button 
                  onClick={() => handleMoveStanza(stanza.id, 'down')}
                  disabled={index === edited.stanzas.length - 1}
                >
                  ↓
                </button>
                <button 
                  onClick={() => setSelectedStanza(stanza)}
                >
                  Edit
                </button>
                <button 
                  onClick={() => handleDeleteStanza(stanza.id)}
                  className="btn-danger"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Verification:**
- Can edit Performance name
- Can edit Performance description
- Can reorder stanzas
- Can delete stanzas
- Save persists changes

---

### 6. Implement Performance Import
**Priority:** 🟡 HIGH  
**Estimate:** 2-3 hours

**Description:**  
Allow importing Performances from JSON files.

**Tasks:**
- [ ] Add import button to sidebar
- [ ] Use Electron dialog to select file
- [ ] Validate imported Performance
- [ ] Add to Performance list

**Update preload.ts:**
```typescript
// Add to VirtuosoAPI
showOpenDialog: (options: unknown) => ipcRenderer.invoke('show-open-dialog', options),
```

**Add to main.ts:**
```typescript
import { dialog } from 'electron';

ipcMain.handle('show-open-dialog', async (_event, options) => {
  return dialog.showOpenDialog(mainWindow!, options);
});
```

**Add Import button to PerformancesSidebar:**
```tsx
<button 
  className="import-button"
  onClick={async () => {
    const result = await window.virtuoso.showOpenDialog({
      filters: [
        { name: 'Performance', extensions: ['json', 'performance.json'] }
      ],
      properties: ['openFile']
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      const imported = await window.virtuoso.importPerformance(result.filePaths[0]);
      if (imported.success) {
        loadPerformances();
      }
    }
  }}
>
  Import
</button>
```

**Verification:**
- File dialog opens
- JSON file can be selected
- Performance added to list
- Invalid files show error

---

### 7. Track Generated IDs for Response Correlation
**Priority:** 🔴 CRITICAL  
**Estimate:** 3-4 hours

**Description:**  
When `{{$id}}` is used and a stanza is sent, track the generated ID so Cues can wait for responses with that ID.

**Tasks:**
- [ ] Store generated IDs in Composer state
- [ ] Pass IDs to Cue when creating from response
- [ ] Automatically suggest ID match when response has same ID as sent stanza

**Update useComposer.ts:**
```typescript
// Add tracking for generated IDs
const generatedIdsRef = useRef<Map<string, string>>(new Map());

const captureSend = useCallback((
  accountAlias: string, 
  xml: string, 
  generatedIds?: Record<string, string>
) => {
  if (!state.isComposing) return;

  // Store generated IDs for later correlation
  if (generatedIds) {
    Object.entries(generatedIds).forEach(([key, value]) => {
      generatedIdsRef.current.set(key, value);
    });
  }

  // ... rest of captureSend
}, [state.isComposing]);

// When creating Cue from response, check if response ID matches a generated ID
const addCueFromResponse = useCallback((
  accountAlias: string,
  responseXml: string
) => {
  if (!state.isComposing) return;

  // Extract ID from response
  const idMatch = responseXml.match(/\bid=['"]([^'"]+)['"]/);
  const responseId = idMatch ? idMatch[1] : null;

  // Check if this ID was generated by us
  let correlatedId: string | undefined;
  if (responseId) {
    generatedIdsRef.current.forEach((genId, key) => {
      if (genId === responseId) {
        correlatedId = responseId;
      }
    });
  }

  // If we found a correlation, default to ID match
  const matchType = correlatedId ? 'id' : 'contains';
  const matchExpression = correlatedId || responseXml.substring(0, 50);

  addCue(accountAlias, matchType, matchExpression, 10000);
}, [state.isComposing, addCue]);
```

**Verification:**
- Generated IDs stored when sending
- Response with matching ID suggests ID-based Cue
- Playback correctly correlates by ID

---

### 8. Playback Progress UI
**Priority:** 🟡 HIGH  
**Estimate:** 4-5 hours

**Description:**  
Show playback progress with status indicators for each stanza.

**Tasks:**
- [ ] Create `src/renderer/components/performances/PlaybackView.tsx`
- [ ] Show progress through stanzas
- [ ] Update status (pending/running/passed/failed) in real-time
- [ ] Show error details for failures

**New File - `src/renderer/components/performances/PlaybackView.tsx`:**
```tsx
import React from 'react';
import { StanzaItem } from './StanzaItem';
import type { Performance, PlaybackResult, StanzaResult } from '../../../types/performance';

interface PlaybackViewProps {
  performance: Performance;
  isPlaying: boolean;
  currentStanzaId: string | null;
  results: StanzaResult[];
  finalResult: PlaybackResult | null;
  onStop: () => void;
}

export function PlaybackView({
  performance,
  isPlaying,
  currentStanzaId,
  results,
  finalResult,
  onStop,
}: PlaybackViewProps): JSX.Element {
  const getStanzaStatus = (stanzaId: string): 'pending' | 'running' | 'passed' | 'failed' => {
    if (currentStanzaId === stanzaId) return 'running';
    const result = results.find(r => r.stanzaId === stanzaId);
    if (!result) return 'pending';
    return result.status === 'passed' ? 'passed' : 'failed';
  };

  return (
    <div className="playback-view">
      <div className="playback-header">
        <h3>{performance.name}</h3>
        {isPlaying ? (
          <button onClick={onStop} className="btn-danger">
            Stop
          </button>
        ) : finalResult ? (
          <span className={`playback-status playback-status-${finalResult.status}`}>
            {finalResult.status.toUpperCase()}
          </span>
        ) : null}
      </div>

      <div className="playback-progress">
        {performance.stanzas.map((stanza, index) => (
          <StanzaItem
            key={stanza.id}
            stanza={stanza}
            index={index + 1}
            status={getStanzaStatus(stanza.id)}
          />
        ))}
      </div>

      {finalResult && (
        <div className="playback-summary">
          <div className="summary-item">
            <span className="label">Duration:</span>
            <span className="value">{(finalResult.duration / 1000).toFixed(2)}s</span>
          </div>
          <div className="summary-item">
            <span className="label">Passed:</span>
            <span className="value passed">{finalResult.summary.passed}</span>
          </div>
          <div className="summary-item">
            <span className="label">Failed:</span>
            <span className="value failed">{finalResult.summary.failed}</span>
          </div>
        </div>
      )}

      {results.filter(r => r.error).map(r => (
        <div key={r.stanzaId} className="playback-error">
          <strong>Error in stanza {r.stanzaId}:</strong>
          <p>{r.error?.message}</p>
        </div>
      ))}
    </div>
  );
}
```

**Verification:**
- Shows all stanzas with pending status initially
- Current stanza shows "running" indicator
- Completed stanzas show pass/fail
- Summary displays at end
- Errors shown with details

---

## 📊 Sprint Summary

| Task | Priority | Estimate | Dependencies |
|------|----------|----------|--------------|
| Response tracking | 🔴 CRITICAL | 4-5 hours | Sprint 1 |
| Cue execution | 🔴 CRITICAL | 4-5 hours | Response tracking |
| Assertion execution | 🔴 CRITICAL | 4-5 hours | Sprint 1 |
| Response context menu | 🔴 CRITICAL | 5-6 hours | Composer |
| Performance editor | 🟡 HIGH | 6-8 hours | Performance store |
| Performance import | 🟡 HIGH | 2-3 hours | Performance store |
| ID correlation tracking | 🔴 CRITICAL | 3-4 hours | Placeholders |
| Playback progress UI | 🟡 HIGH | 4-5 hours | Playback engine |

**Total Estimate: 34-41 hours (2 weeks at 15-20 hours/week)**

---

## ✅ Definition of Done

- [ ] Cues pause until matching response
- [ ] ID-based correlation works (`{{$id}}`)
- [ ] Contains assertions pass/fail correctly
- [ ] Regex assertions work
- [ ] XPath assertions work (basic)
- [ ] Click on response adds Cue or assertion
- [ ] Can edit existing Performances
- [ ] Can import from JSON file
- [ ] Playback shows real-time progress
- [ ] All tests pass manually
