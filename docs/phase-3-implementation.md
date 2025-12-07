# Phase 3: Advanced Features (3-4 weeks)

## 🎯 Phase Goal

Implement advanced XMPP features, collections/workspaces, multi-stanza workflows, and a modern, polished design system. This phase transforms Virtuoso from a testing tool into a comprehensive XMPP development platform.

## 📋 Success Criteria

- [ ] Collections system for organizing related test cases
- [ ] Advanced XMPP features (MUC, PubSub, Service Discovery) working
- [ ] Multi-stanza workflows with chaining and logic
- [ ] Modern design system implemented throughout
- [ ] Resizable panels with saved preferences
- [ ] Professional UI matching or exceeding Postman quality

## 🔨 Work Items

### 1. Collections & Workspaces System
**Priority:** 🔴 CRITICAL  
**Estimate:** 16-20 hours

**Description:**  
Implement a Postman-style collections system for organizing related stanzas, test cases, and workflows into logical groups.

**Tasks:**
- [ ] Design collection data structure (id, name, description, items, folders)
- [ ] Create collection storage system
- [ ] Build collections sidebar/navigator
- [ ] Add create/edit/delete collection
- [ ] Support nested folders within collections
- [ ] Drag-and-drop to organize items
- [ ] Add collection sharing/export
- [ ] Import collections from JSON
- [ ] Collection templates for common scenarios
- [ ] Collection-level variables
- [ ] Run entire collection feature
- [ ] Collection run results viewer

**Files to Modify:**
- [`src/renderer/App.tsx`](file:///Users/boblove/github/virtuoso/src/renderer/App.tsx)

**New Files:**
- `src/main/collectionStore.ts` - Collection persistence
- `src/renderer/components/CollectionNavigator.tsx` - Collections sidebar
- `src/renderer/components/CollectionEditor.tsx` - Edit collection details
- `src/renderer/components/FolderTree.tsx` - Nested folder structure
- `src/renderer/components/CollectionRunner.tsx` - Run collection UI
- `src/types/collection.ts` - Collection type definitions

**Collection Structure:**
```typescript
interface Collection {
  id: string;
  name: string;
  description: string;
  variables: Record<string, string>; // Collection-level vars
  folders: Folder[];
  items: CollectionItem[];
  created: Date;
  updated: Date;
}

interface CollectionItem {
  id: string;
  name: string;
  type: 'stanza' | 'workflow';
  xml: string;
  folderId?: string;
  assertions?: Assertion[];
}
```

**Default Collections to Include:**
- "XMPP Basics" - Common stanzas
- "MUC Testing" - Multi-user chat scenarios
- "PubSub Examples" - Pub/sub operations
- "Authentication Tests" - Various auth methods

**Acceptance Criteria:**
- Can create collections with folders
- Can add stanzas to collections
- Can organize with drag-and-drop
- Can export/import collections
- Can run entire collection in sequence
- Collection variables work in stanzas

**Verification:**
- Create new collection with name "Test Suite"
- Add folders "Setup", "Tests", "Teardown"
- Add stanzas to each folder
- Drag to reorder items
- Run entire collection - should execute in order
- Export collection - should create JSON file

---

### 2. Multi-Stanza Workflows
**Priority:** 🔴 CRITICAL  
**Estimate:** 12-16 hours

**Description:**  
Enable creating test workflows that chain multiple stanzas together with conditional logic, delays, and response validation.

**Tasks:**
- [ ] Design workflow data structure
- [ ] Build workflow editor UI
- [ ] Implement workflow execution engine
- [ ] Add delay/wait steps
- [ ] Add conditional branching (if/else)
- [ ] Support loops (for/while)
- [ ] Extract data from responses (XPath/regex)
- [ ] Store extracted values in variables
- [ ] Use variables in subsequent stanzas
- [ ] Workflow execution progress viewer
- [ ] Pause/resume workflow execution
- [ ] Stop workflow on error option

**Files to Modify:**
- [`src/renderer/App.tsx`](file:///Users/boblove/github/virtuoso/src/renderer/App.tsx)

**New Files:**
- `src/main/workflowEngine.ts` - Workflow execution logic
- `src/renderer/components/WorkflowEditor.tsx` - Workflow builder UI
- `src/renderer/components/WorkflowStep.tsx` - Individual step component
- `src/renderer/components/WorkflowRunner.tsx` - Execution viewer
- `src/types/workflow.ts` - Workflow type definitions
- `src/utils/dataExtractor.ts` - Extract data from responses

**Workflow Example:**
```yaml
name: "MUC Join and Send Message"
steps:
  - send: presence-join-muc.xml
    wait: 1000
  - extract:
      xpath: "//presence/@from"
      save_as: "my_jid"
  - send: message-to-room.xml
    variables:
      from: "{{my_jid}}"
  - assert:
      response_contains: "message received"
```

**Acceptance Criteria:**
- Can create multi-step workflows visually
- Can add delays between steps
- Can extract data from responses
- Can use variables in subsequent stanzas
- Can add conditional logic
- Workflow execution shows progress
- Can pause/resume/stop workflows

**Verification:**
- Create 3-step workflow: send presence, wait 1s, send message
- Run workflow - should execute steps in order with delays
- Add variable extraction from first response
- Use variable in second stanza
- Verify workflow completes successfully

---

### 3. Advanced XMPP Features - MUC Support
**Priority:** 🟡 HIGH  
**Estimate:** 10-12 hours

**Description:**  
Add first-class support for Multi-User Chat (XEP-0045) with UI helpers for common MUC operations.

**Tasks:**
- [ ] Add MUC room management UI
- [ ] Join room helper (auto-generate correct stanza)
- [ ] Leave room helper
- [ ] Send message to room
- [ ] List room occupants
- [ ] Room configuration
- [ ] Private messages within MUC
- [ ] Room creation
- [ ] Kick/ban users
- [ ] Set room subject
- [ ] Display MUC presence separately

**Files to Modify:**
- [`src/renderer/App.tsx`](file:///Users/boblove/github/virtuoso/src/renderer/App.tsx)

**New Files:**
- `src/renderer/components/MucPanel.tsx` - MUC operations UI
- `src/renderer/components/MucRoomList.tsx` - Active rooms list
- `src/renderer/components/MucOccupants.tsx` - Room participants
- `src/utils/mucHelpers.ts` - MUC stanza generators

**MUC Operations:**
- Join room: `<presence to='room@conference.server/nick'>`
- Send to room: `<message to='room@conference.server' type='groupchat'>`
- Leave room: `<presence to='room@conference.server/nick' type='unavailable'>`
- Private message: `<message to='room@conference.server/nick'>`

**Acceptance Criteria:**
- Can join MUC room with UI helper
- Can send messages to room
- Can see room occupants
- Can leave room
- Can send private messages to occupants
- MUC stanzas use correct format

**Verification:**
- Use MUC helper to join a test room
- Send message to room - should appear in responses
- Check occupants list
- Send private message to occupant
- Leave room - should send correct presence

---

### 4. Advanced XMPP Features - PubSub Support
**Priority:** 🟡 HIGH  
**Estimate:** 8-10 hours

**Description:**  
Add support for Publish-Subscribe (XEP-0060) operations with UI helpers.

**Tasks:**
- [ ] Add PubSub panel to UI
- [ ] Create node helper
- [ ] Delete node helper
- [ ] Subscribe to node
- [ ] Unsubscribe from node
- [ ] Publish item to node
- [ ] Retrieve items from node
- [ ] Purge node items
- [ ] List all nodes
- [ ] Node configuration
- [ ] Display PubSub events separately

**New Files:**
- `src/renderer/components/PubSubPanel.tsx` - PubSub operations UI
- `src/utils/pubsubHelpers.ts` - PubSub stanza generators

**PubSub Operations:**
- Create node: IQ-set with `<pubsub><create node='...'/></pubsub>`
- Subscribe: IQ-set with `<pubsub><subscribe node='...' jid='...'/></pubsub>`
- Publish: IQ-set with `<pubsub><publish node='...'><item>...</item></publish></pubsub>`

**Acceptance Criteria:**
- Can create PubSub nodes
- Can subscribe to nodes
- Can publish items
- Can retrieve items
- Can unsubscribe from nodes
- All operations use correct stanza format

**Verification:**
- Create a test node
- Subscribe to the node
- Publish an item
- Retrieve items - should see published item
- Unsubscribe from node

---

### 5. Advanced XMPP Features - Service Discovery
**Priority:** 🟢 MEDIUM  
**Estimate:** 6-8 hours

**Description:**  
Add service discovery (XEP-0030) to automatically discover server capabilities and available services.

**Tasks:**
- [ ] Add "Discover Server" button
- [ ] Query server features (disco#info)
- [ ] Query server items (disco#items)
- [ ] Display discovered features in UI
- [ ] Display available services
- [ ] Query individual service capabilities
- [ ] Cache discovery results
- [ ] Auto-enable features based on discovery

**New Files:**
- `src/renderer/components/ServiceDiscovery.tsx` - Discovery UI
- `src/main/discoveryManager.ts` - Discovery logic

**Acceptance Criteria:**
- Can discover server features with one click
- Features are displayed in readable format
- Can see available services (MUC, PubSub, etc.)
- Discovery results are cached
- Can query individual services

**Verification:**
- Click "Discover Server" on connected account
- Should see list of server features
- Should see available services
- Click on a service - should show its capabilities

---

### 6. Modern Design System Implementation
**Priority:** 🔴 CRITICAL  
**Estimate:** 16-20 hours

**Description:**  
Implement a comprehensive, modern design system that makes Virtuoso visually competitive with professional tools like Postman.

**Tasks:**
- [ ] Choose and integrate component library (or build custom)
- [ ] Define complete color palette (primary, secondary, accent, semantic)
- [ ] Create typography system (scale, weights, line heights)
- [ ] Define spacing system (4px/8px grid)
- [ ] Create shadow/elevation system
- [ ] Design and implement all button variants
- [ ] Design card components
- [ ] Design modal/dialog components
- [ ] Design form components
- [ ] Implement dark mode support
- [ ] Create icon system
- [ ] Add smooth transitions and animations
- [ ] Implement consistent border radius
- [ ] Create loading skeletons

**Component Library Options:**
- **Build custom** - Full control, matches vision exactly
- **Radix UI** - Headless, full control over styling
- **Shadcn/ui** - Beautiful defaults, customizable
- **Material-UI** - Mature, comprehensive
- **Ant Design** - Professional, feature-rich

**Design Tokens Example:**
```css
:root {
  /* Colors */
  --color-primary-50: #e3f2fd;
  --color-primary-500: #2196f3;
  --color-primary-700: #1976d2;
  
  /* Spacing (4px grid) */
  --space-1: 4px;
  --space-2: 8px;
  --space-4: 16px;
  
  /* Typography */
  --font-sans: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.1);
}
```

**Files to Modify:**
- All component files - apply new design system

**New Files:**
- `src/renderer/styles/theme.css` - Design tokens
- `src/renderer/styles/components.css` - Component styles
- `src/renderer/components/ui/*` - Reusable UI components
- `src/renderer/hooks/useTheme.ts` - Theme context

**Acceptance Criteria:**
- Consistent visual language throughout app
- Dark mode works perfectly
- All colors from defined palette
- Consistent spacing using design tokens
- Professional, modern aesthetic
- Smooth animations and transitions
- Looks comparable to Postman/Insomnia

**Verification:**
- Visual inspection of entire app
- Toggle between light and dark mode
- Check color contrast (accessibility)
- Verify all components use design system
- Get feedback from external users

---

### 7. Resizable Panels with Persistence
**Priority:** 🟡 HIGH  
**Estimate:** 6-8 hours

**Description:**  
Implement draggable panel dividers so users can customize their workspace layout and persist their preferences.

**Tasks:**
- [ ] Integrate react-resizable-panels or similar
- [ ] Make sidebar resizable (account list)
- [ ] Make response panel resizable (top/bottom split)
- [ ] Add horizontal/vertical split options
- [ ] Persist panel sizes to local storage
- [ ] Add "Reset Layout" option
- [ ] Set sensible min/max widths
- [ ] Add visual feedback while dragging

**Dependencies to Add:**
- `react-resizable-panels` or `react-split-pane`

**Files to Modify:**
- [`src/renderer/App.tsx`](file:///Users/boblove/github/virtuoso/src/renderer/App.tsx)

**New Files:**
- `src/renderer/components/ResizableLayout.tsx` - Layout wrapper
- `src/hooks/useLayoutPreferences.ts` - Persist layout

**Acceptance Criteria:**
- Can drag sidebar edge to resize
- Can resize response panel
- Layout persists across app restarts
- Can reset to default layout
- Panels have minimum/maximum sizes
- Drag handle is clearly visible

**Verification:**
- Resize sidebar - should move smoothly
- Close app and reopen - sizes should be remembered
- Resize to minimum - should stop at min width
- Click "Reset Layout" - should return to defaults

---

### 8. Test Scripting with Pre/Post Scripts
**Priority:** 🟢 MEDIUM  
**Estimate:** 12-14 hours

**Description:**  
Add JavaScript scripting capabilities similar to Postman's pre-request and test scripts.

**Tasks:**
- [ ] Create scripting sandbox environment
- [ ] Add pre-send script editor to stanza
- [ ] Add post-receive script editor to stanza
- [ ] Provide API for script context (variables, assertions, etc.)
- [ ] Implement assertions library
- [ ] Add script execution logging
- [ ] Add script error handling
- [ ] Create script template library
- [ ] Support external libraries (limited)
- [ ] Add script debugging support

**Script Context API:**
```javascript
// Pre-send script
virtuoso.variables.set('timestamp', Date.now());
virtuoso.stanza.setVariable('time', '{{timestamp}}');

// Post-receive script
virtuoso.test('Status is success', () => {
  virtuoso.expect(response).toContain('type="result"');
});
```

**New Files:**
- `src/main/scriptRunner.ts` - Script execution engine
- `src/renderer/components/ScriptEditor.tsx` - Script editor UI
- `src/utils/scriptingApi.ts` - API provided to scripts
- `src/utils/assertions.ts` - Assertion library

**Acceptance Criteria:**
- Can write pre-send scripts that modify stanzas
- Can write post-receive scripts that validate responses
- Scripts have access to variables
- Scripts can make assertions
- Script errors are caught and displayed
- Script console shows logs

**Verification:**
- Write pre-send script that sets variable
- Verify variable appears in sent stanza
- Write post-receive script with assertion
- Send stanza - assertion should pass/fail
- Write script with error - should show error message

---

## 🎨 UI Vision

After Phase 3, Virtuoso should have:
- ✅ Professional design rivaling Postman
- ✅ Dark mode support
- ✅ Resizable, customizable layout
- ✅ Collections-based organization
- ✅ Workflow builder interface
- ✅ Advanced XMPP operation panels
- ✅ Smooth animations throughout

## 📦 Dependencies to Add

```json
{
  "dependencies": {
    "react-resizable-panels": "^2.0.0",
    "react-beautiful-dnd": "^13.1.1",
    "xpath": "^0.0.34"
  },
  "devDependencies": {
    "@types/xpath": "^0.0.32"
  }
}
```

## 🧪 Testing Checklist

Before completing Phase 3, verify:
- [ ] Can create and organize collections
- [ ] Can create multi-step workflows
- [ ] Workflows execute correctly
- [ ] Can join MUC rooms and send messages
- [ ] Can create PubSub nodes and publish
- [ ] Service discovery works
- [ ] Dark mode works throughout
- [ ] Design system is consistent
- [ ] Panels are resizable
- [ ] Layout persists across restarts
- [ ] Scripts can modify stanzas
- [ ] Scripts can validate responses
- [ ] All Phase 1 & 2 features still work

## 📝 Notes

- This is the most ambitious phase
- Collections system is essential for professional use
- Design system implementation affects entire app
- Consider breaking into sub-phases if needed
- Get user feedback on design before finalizing

## 🚀 Next Phase

After completing Phase 3, proceed to [Phase 4: Polish & Scale](file:///Users/boblove/github/virtuoso/docs/phase-4-implementation.md)
