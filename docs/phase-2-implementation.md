# Phase 2: Core Features (2-3 weeks)

## 🎯 Phase Goal

Implement essential Postman-like features that dramatically improve the day-to-day workflow for XMPP testing. Focus on stanza templates, improved XML editing, response management, and data import/export capabilities.

## 📋 Success Criteria

- [ ] Users can save and reuse stanza templates
- [ ] XML editor has syntax highlighting and validation
- [ ] Responses can be filtered and searched
- [ ] Test cases and templates can be exported/imported
- [ ] Forms have comprehensive validation with helpful feedback
- [ ] Connection testing before saving accounts

## 🔨 Work Items

### 1. Stanza Templates System
**Priority:** 🔴 CRITICAL  
**Estimate:** 12-16 hours

**Description:**  
Build a comprehensive template system for saving, organizing, and reusing common XMPP stanzas. This is a core feature that will set Virtuoso apart.

**Tasks:**
- [ ] Design template data structure (id, name, description, xml, category, tags, created, updated)
- [ ] Create template storage using electron-store
- [ ] Build template library UI component
- [ ] Add "Save as Template" button to stanza form
- [ ] Add template browser/selector
- [ ] Implement template categories (Message, Presence, IQ, Custom)
- [ ] Add search/filter for templates
- [ ] Add template editing capabilities
- [ ] Add template deletion with confirmation
- [ ] Create default template library (common stanzas)
- [ ] Add variable substitution in templates (e.g., {{jid}}, {{message}})

**Files to Modify:**
- [`src/renderer/App.tsx`](file:///Users/boblove/github/virtuoso/src/renderer/App.tsx)

**New Files:**
- `src/main/templateStore.ts` - Template persistence layer
- `src/renderer/components/TemplateLibrary.tsx` - Template browser UI
- `src/renderer/components/TemplateSaveDialog.tsx` - Save template modal
- `src/renderer/components/TemplateCard.tsx` - Individual template display
- `src/data/defaultTemplates.json` - Bundled common templates
- `src/types/template.ts` - Template type definitions

**Default Templates to Include:**
- Basic message stanza
- Presence stanza (available, away, dnd)
- Roster query (XEP-0092)
- Service discovery (XEP-0030)
- Version query (XEP-0092)
- Ping (XEP-0199)
- MUC join (XEP-0045)
- PubSub subscribe (XEP-0060)

**Acceptance Criteria:**
- Can save any stanza as a template with name and description
- Can browse and search saved templates
- Can load template into editor with one click
- Can edit and update existing templates
- Can delete templates
- Templates support variable substitution
- Default templates are available on first launch

**Verification:**
- Create a template from a custom stanza
- Browse template library - should see the new template
- Search for template by name
- Load template - should populate XML editor
- Edit template and save changes
- Delete template - should ask for confirmation

---

### 2. Advanced XML Editor
**Priority:** 🔴 CRITICAL  
**Estimate:** 8-12 hours

**Description:**  
Replace the basic textarea with a powerful XML code editor that includes syntax highlighting, validation, formatting, and helpful editing features.

**Tasks:**
- [ ] Integrate Monaco Editor or CodeMirror
- [ ] Configure XML language mode
- [ ] Add syntax highlighting
- [ ] Add line numbers
- [ ] Add auto-formatting (Ctrl/Cmd + Shift + F)
- [ ] Add real-time XML validation with error markers
- [ ] Add bracket matching and auto-closing tags
- [ ] Add auto-indentation
- [ ] Configure dark and light themes
- [ ] Add "Format XML" button
- [ ] Show character/line count

**Dependencies to Add:**
- `@monaco-editor/react` OR `@uiw/react-codemirror` with XML mode

**Files to Modify:**
- [`src/renderer/App.tsx`](file:///Users/boblove/github/virtuoso/src/renderer/App.tsx)
- [`package.json`](file:///Users/boblove/github/virtuoso/package.json)

**New Files:**
- `src/renderer/components/XmlEditor.tsx` - Wrapped editor component
- `src/utils/xmlValidator.ts` - XML validation utilities

**Acceptance Criteria:**
- XML code is syntax highlighted with colors
- Invalid XML shows red underlines with error messages
- Can format messy XML with one click
- Line numbers are visible
- Bracket matching works
- Auto-indentation works when pressing Enter
- Editor is pleasant to use

**Verification:**
- Type an XML stanza - should see syntax highlighting
- Type invalid XML - should see error indicators
- Paste unformatted XML and click Format - should prettify
- Type `<message>` - should auto-close with `</message>`

---

### 3. Response Filtering & Search
**Priority:** 🟡 HIGH  
**Estimate:** 8-10 hours

**Description:**  
Add powerful filtering and search capabilities to help users find specific stanzas in potentially large response lists.

**Tasks:**
- [ ] Add filter controls above response list
- [ ] Implement stanza type filter (message/presence/iq/error)
- [ ] Implement JID filter (from/to)
- [ ] Implement timestamp/date range filter
- [ ] Add full-text search in stanza content
- [ ] Add regex search option
- [ ] Color-code stanzas by type
- [ ] Add icons for different stanza types
- [ ] Show filter count (e.g., "Showing 5 of 42 responses")
- [ ] Add "Export Filtered Results" option
- [ ] Persist filter settings across sessions

**Files to Modify:**
- [`src/renderer/App.tsx`](file:///Users/boblove/github/virtuoso/src/renderer/App.tsx)

**New Files:**
- `src/renderer/components/ResponseFilters.tsx` - Filter UI controls
- `src/renderer/components/ResponseList.tsx` - Enhanced response list
- `src/renderer/components/StanzaTypeIcon.tsx` - Type-specific icons
- `src/utils/stanzaFilter.ts` - Filter logic utilities

**Acceptance Criteria:**
- Can filter responses by type (checkboxes)
- Can filter by JID using input field
- Can search stanza content with text search
- Can use regex for advanced searches
- Stanzas are color-coded by type
- Each stanza shows appropriate icon
- Filter count is displayed
- Filters persist when switching accounts

**Verification:**
- Send multiple different stanza types
- Use type filter - should show only selected types
- Search for specific text - should filter results
- Use regex search - should work correctly
- Clear filters - should show all responses

---

### 4. Import/Export Functionality
**Priority:** 🟡 HIGH  
**Estimate:** 6-8 hours

**Description:**  
Enable users to backup their work, share test cases with team members, and import configurations from other sources.

**Tasks:**
- [ ] Export accounts (without passwords) to JSON
- [ ] Export templates to JSON
- [ ] Export individual template
- [ ] Export all data (accounts + templates) as backup
- [ ] Import accounts from JSON
- [ ] Import templates from JSON
- [ ] Validate imported data format
- [ ] Handle import conflicts (duplicate IDs)
- [ ] Add import/export menu items
- [ ] Add drag-and-drop import support
- [ ] Export responses for selected account

**Files to Modify:**
- [`src/renderer/App.tsx`](file:///Users/boblove/github/virtuoso/src/renderer/App.tsx)

**New Files:**
- `src/main/exportImport.ts` - Export/import logic
- `src/renderer/components/ExportDialog.tsx` - Export options dialog
- `src/renderer/components/ImportDialog.tsx` - Import file selector
- `src/utils/dataValidation.ts` - Validate import data

**Export Format:**
```json
{
  "version": "1.0",
  "exported": "2025-12-07T15:35:13Z",
  "accounts": [...],
  "templates": [...]
}
```

**Acceptance Criteria:**
- Can export all templates to JSON file
- Can export accounts (passwords excluded or encrypted)
- Can import templates from valid JSON
- Can import accounts and merge with existing
- Invalid import files show helpful error messages
- Can drag-drop JSON file to import
- Export files include metadata (version, date)

**Verification:**
- Export templates - should download JSON file
- Import the same file - should work without errors
- Export accounts - passwords should not be plain text
- Import accounts - should merge with existing
- Try to import invalid JSON - should show error

---

### 5. Enhanced Form Validation
**Priority:** 🟡 HIGH  
**Estimate:** 4-6 hours

**Description:**  
Improve all forms with comprehensive validation, helpful error messages, and better UX with inline feedback.

**Tasks:**
- [ ] Add real-time validation to all form fields
- [ ] Show validation errors inline (below fields)
- [ ] Add success indicators (green checkmark)
- [ ] Validate JID format (user@domain/resource)
- [ ] Validate port range (1-65535)
- [ ] Validate required fields
- [ ] Add helpful placeholder text
- [ ] Add field descriptions/help text
- [ ] Disable submit button when form is invalid
- [ ] Add "Show/Hide Password" toggle
- [ ] Add password strength indicator (optional)

**Files to Modify:**
- [`src/renderer/App.tsx`](file:///Users/boblove/github/virtuoso/src/renderer/App.tsx)

**New Files:**
- `src/renderer/components/FormField.tsx` - Reusable form field component
- `src/utils/validators.ts` - Validation functions
- `src/renderer/components/PasswordInput.tsx` - Password field with toggle

**Validation Rules:**
- **JID**: Must match pattern `user@domain` or `user@domain/resource`
- **Host**: Valid hostname or IP address
- **Port**: Number between 1 and 65535
- **Account ID**: Alphanumeric, no spaces, unique

**Acceptance Criteria:**
- Form fields show validation state (error/success)
- Error messages are helpful and specific
- Can't submit invalid form (button disabled)
- Password can be shown/hidden
- Validation happens in real-time as user types
- Success states are indicated visually

**Verification:**
- Try to submit empty form - should show errors
- Enter invalid JID - should show specific error message
- Enter invalid port (e.g., 99999) - should show error
- Fill form correctly - should show success indicators
- Submit button should enable only when valid

---

### 6. Connection Test Feature
**Priority:** 🟢 MEDIUM  
**Estimate:** 4-6 hours

**Description:**  
Add ability to test XMPP connection before saving account, providing immediate feedback on connectivity and credentials.

**Tasks:**
- [ ] Add "Test Connection" button to account form
- [ ] Implement temporary connection test (don't save account)
- [ ] Show loading state during test
- [ ] Display test results (success/failure with details)
- [ ] Show connection time
- [ ] List detected server features (if successful)
- [ ] Provide troubleshooting tips for common errors

**Files to Modify:**
- [`src/renderer/App.tsx`](file:///Users/boblove/github/virtuoso/src/renderer/App.tsx)
- [`src/main/main.ts`](file:///Users/boblove/github/virtuoso/src/main/main.js)

**New Files:**
- `src/main/connectionTester.ts` - Connection test logic
- `src/renderer/components/ConnectionTestResult.tsx` - Test result display

**IPC Channels to Add:**
- `test-connection` - Test connection without saving

**Acceptance Criteria:**
- "Test Connection" button available on account form
- Button shows loading state during test
- Success results show green indicator + connection time
- Failure results show red indicator + error message
- Common errors have helpful troubleshooting tips
- Test doesn't save the account

**Verification:**
- Fill account form with valid credentials, click Test - should succeed
- Fill with invalid password, click Test - should fail with auth error
- Fill with wrong host, click Test - should fail with connection error
- Test result should appear within 5 seconds

---

### 7. Keyboard Shortcuts
**Priority:** 🟢 MEDIUM  
**Estimate:** 4-5 hours

**Description:**  
Add essential keyboard shortcuts to speed up common workflows.

**Tasks:**
- [ ] Implement keyboard shortcut system
- [ ] Add Cmd/Ctrl + Enter to send stanza
- [ ] Add Cmd/Ctrl + K to clear responses
- [ ] Add Cmd/Ctrl + N to create new template
- [ ] Add Cmd/Ctrl + 1-9 to switch between accounts
- [ ] Add Cmd/Ctrl + / to show keyboard shortcuts help
- [ ] Add Escape to close modals/dialogs
- [ ] Display keyboard hints in UI tooltips
- [ ] Create keyboard shortcuts overlay

**Dependencies to Add:**
- `react-hotkeys-hook` - Keyboard shortcut management

**Files to Modify:**
- [`src/renderer/App.tsx`](file:///Users/boblove/github/virtuoso/src/renderer/App.tsx)
- [`package.json`](file:///Users/boblove/github/virtuoso/package.json)

**New Files:**
- `src/renderer/components/KeyboardShortcutsHelp.tsx` - Shortcuts overlay
- `src/hooks/useKeyboardShortcuts.ts` - Custom hook for shortcuts

**Keyboard Shortcuts:**
- `Cmd/Ctrl + Enter` - Send stanza
- `Cmd/Ctrl + K` - Clear responses
- `Cmd/Ctrl + N` - New template
- `Cmd/Ctrl + 1-9` - Switch to account 1-9
- `Cmd/Ctrl + /` - Show shortcuts help
- `Escape` - Close modal/dialog

**Acceptance Criteria:**
- All listed shortcuts work correctly
- Shortcuts are shown in tooltips
- Help overlay shows all available shortcuts
- Shortcuts work consistently across the app
- Command key on Mac, Control on Windows/Linux

**Verification:**
- Press Cmd/Ctrl + Enter while in editor - should send
- Press Cmd/Ctrl + K - should clear responses
- Press Cmd/Ctrl + / - should show help overlay
- Press Escape on help overlay - should close

---

### 8. Response Export
**Priority:** 🟢 MEDIUM  
**Estimate:** 3-4 hours

**Description:**  
Allow exporting response history for documentation, debugging, or sharing with team members.

**Tasks:**
- [ ] Add "Export Responses" button
- [ ] Export as JSON format
- [ ] Export as plain text format
- [ ] Export as XML (concatenated stanzas)
- [ ] Include metadata (timestamp, account, direction)
- [ ] Allow exporting filtered results only
- [ ] Allow exporting selected responses
- [ ] Choose export location with file dialog

**Files to Modify:**
- [`src/renderer/App.tsx`](file:///Users/boblove/github/virtuoso/src/renderer/App.tsx)

**New Files:**
- `src/utils/responseExporter.ts` - Export formatting logic

**Export Format Example (JSON):**
```json
{
  "account": "test@localhost",
  "exported": "2025-12-07T15:35:13Z",
  "count": 10,
  "responses": [
    {
      "timestamp": "2025-12-07T15:30:00Z",
      "direction": "received",
      "stanza": "<message>...</message>"
    }
  ]
}
```

**Acceptance Criteria:**
- Can export all responses for current account
- Can choose export format (JSON/TXT/XML)
- Can export only filtered responses
- Export includes timestamps and metadata
- File dialog lets user choose save location

**Verification:**
- Send and receive several stanzas
- Click Export - should open file dialog
- Save as JSON - should create valid JSON file
- Apply filter, export - should only export filtered items

---

## 🎨 UI Enhancements

After Phase 2, the UI should have:
- ✅ Modern code editor with syntax highlighting
- ✅ Template library browser
- ✅ Advanced response filtering controls
- ✅ Better form validation with inline feedback
- ✅ Keyboard shortcuts for power users
- ✅ Import/export dialogs

## 📦 Dependencies to Add

```json
{
  "dependencies": {
    "@monaco-editor/react": "^4.6.0",
    "react-hotkeys-hook": "^4.5.0"
  }
}
```

## 🧪 Testing Checklist

Before completing Phase 2, verify:
- [ ] Can save stanza as template
- [ ] Can browse and load templates
- [ ] Can edit and delete templates
- [ ] XML editor highlights syntax correctly
- [ ] Can format messy XML
- [ ] Can filter responses by type
- [ ] Can search response content
- [ ] Can export templates to JSON
- [ ] Can import templates from JSON
- [ ] Can export responses
- [ ] Forms show validation errors
- [ ] Can test connection before saving
- [ ] Keyboard shortcuts work
- [ ] All features from Phase 1 still work

## 📝 Notes

- Template system is the most important feature in this phase
- XML editor will dramatically improve user experience
- Import/export enables team collaboration
- These features establish Virtuoso as a professional tool

## 🚀 Next Phase

After completing Phase 2, proceed to [Phase 3: Advanced Features](file:///Users/boblove/github/virtuoso/docs/phase-3-implementation.md)
