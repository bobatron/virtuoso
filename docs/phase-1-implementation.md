# Phase 1: Foundation (1-2 weeks)

## 🎯 Phase Goal

Establish a secure, stable, and maintainable foundation for Virtuoso by addressing critical security vulnerabilities, fixing existing bugs, and modernizing the codebase. This phase focuses on technical debt and essential improvements that will enable faster development in subsequent phases.

## 📋 Success Criteria

- [ ] All passwords encrypted at rest (no plain text credentials)
- [ ] All backend code migrated to TypeScript with proper type safety
- [ ] Zero critical bugs remaining
- [ ] All dependencies properly declared in package.json
- [ ] Basic UI improvements visible (modern fonts, better colors, consistent spacing)
- [ ] Error handling improved with user-friendly feedback
- [ ] `accounts.json` excluded from version control

## 🔨 Work Items

### 1. Fix XMPP Connection & Encryption Support
**Priority:** 🔴 CRITICAL  
**Estimate:** 3-4 hours

**Description:**  
Currently, Virtuoso can only connect to OpenFire when encryption is disabled. We need to support standard XMPP encryption (STARTTLS/Direct TLS) to work with properly configured servers.

**Tasks:**
- [ ] Fix hardcoded `xmpp://` protocol in xmppManager.js
- [ ] Add support for `xmpps://` (direct TLS on port 5223)
- [ ] Enable STARTTLS by default (port 5222)
- [ ] Add connection method option in account form (Auto/STARTTLS/Direct TLS/Plain)
- [ ] Test with OpenFire using default encryption settings
- [ ] Add certificate validation options (for self-signed certs in dev)

**Files to Modify:**
- [`src/main/xmppManager.js`](file:///Users/boblove/github/virtuoso/src/main/xmppManager.js) - Fix connection configuration
- [`src/renderer/App.tsx`](file:///Users/boblove/github/virtuoso/src/renderer/App.tsx) - Add connection method option

**Current Issue:**
```javascript
// Line 22 - Forces unencrypted connection
service: `xmpp://${host}:${port}`,
```

**Solution:**
```javascript
// Auto-detect based on port or let user choose
const protocol = port === '5223' ? 'xmpps' : 'xmpp';
service: `${protocol}://${host}:${port}`,
```

**Acceptance Criteria:**
- Can connect to OpenFire with default encryption settings
- Supports both STARTTLS (5222) and Direct TLS (5223)
- Connection method is configurable per account
- Works with self-signed certificates in development

**Verification:**
- Connect to OpenFire on port 5222 with STARTTLS - should work
- Connect to OpenFire on port 5223 with Direct TLS - should work
- Test with production XMPP server - should work

---

### 2. Dual-Mode Password Storage (Development + Production)
**Priority:** 🔴 CRITICAL  
**Estimate:** 4-6 hours

**Description:**  
Implement secure password storage for production while maintaining development convenience. Support two modes:
- **Development**: `accounts.json` with plain text (gitignored, manual editing for quick testing)
- **Production**: Encrypted storage for UI-added accounts

**Tasks:**
- [ ] Add `electron-store` dependency to package.json
- [ ] Configure electron-store with encryption enabled
- [ ] Create dual storage system:
  - Load from `accounts.json` if exists (development mode)
  - Store UI-added accounts in encrypted store (production mode)
- [ ] Add `.gitignore` entry for `accounts.json`
- [ ] Add `.accounts.json.example` template file for developers
- [ ] Document the dual-mode approach in README
- [ ] Add environment flag to toggle behavior if needed

**Files to Modify:**
- [`package.json`](file:///Users/boblove/github/virtuoso/package.json) - Add electron-store dependency
- [`src/main/accountStore.js`](file:///Users/boblove/github/virtuoso/src/main/accountStore.js) - Implement dual storage
- [`.gitignore`](file:///Users/boblove/github/virtuoso/.gitignore) - Add accounts.json

**New Files:**
- `.accounts.json.example` - Template for developers

**Storage Strategy:**
1. On load: Merge accounts from `accounts.json` (if exists) + encrypted store
2. On save via UI: Always save to encrypted store
3. Manual edits to `accounts.json` are preserved (developer workflow)
4. Accounts from `accounts.json` show as "(dev)" in UI (optional)

**Acceptance Criteria:**
- Can manually edit `accounts.json` for quick testing (plain text)
- UI-added accounts are encrypted automatically
- `accounts.json` is gitignored
- Both storage methods work simultaneously
- No data loss when switching between modes

**Verification:**
- Add account via UI - should be encrypted in store
- Add account to `accounts.json` manually - should load on restart
- Verify both accounts appear in UI
- Check encrypted store - UI accounts should be encrypted
- Check `accounts.json` - should remain plain text

---

### 3. Add Missing Dependencies
**Priority:** 🔴 CRITICAL  
**Estimate:** 15 minutes

**Description:**  
The `ltx` package is imported in `xmppManager.js` but not declared in `package.json`, which will cause runtime errors.

**Tasks:**
- [ ] Add `ltx` to dependencies in package.json
- [ ] Run `npm install` to verify installation
- [ ] Test stanza sending functionality

**Files to Modify:**
- [`package.json`](file:///Users/boblove/github/virtuoso/package.json)

**Acceptance Criteria:**
- ltx package is in package.json dependencies
- npm install completes successfully
- No console errors about missing modules

**Verification:**
- Run `npm install`
- Start the app and send a test stanza
- Check console for any import errors

---

### 4. Convert Backend to TypeScript
**Priority:** 🟡 HIGH  
**Estimate:** 8-12 hours

**Description:**  
Migrate all `.js` files in `src/main` to TypeScript for better type safety, developer experience, and maintainability.

**Tasks:**
- [ ] Rename all `.js` files to `.ts`
- [ ] Add type definitions for Electron APIs
- [ ] Add type definitions for @xmpp/client
- [ ] Create interfaces for Account, AccountData, etc.
- [ ] Create typed IPC channel contracts
- [ ] Fix all TypeScript errors
- [ ] Update tsconfig.json for both main and renderer processes
- [ ] Update build configuration if needed

**Files to Modify:**
- [`src/main/main.js`](file:///Users/boblove/github/virtuoso/src/main/main.js) → `main.ts`
- [`src/main/xmppManager.js`](file:///Users/boblove/github/virtuoso/src/main/xmppManager.js) → `xmppManager.ts`
- [`src/main/accountStore.js`](file:///Users/boblove/github/virtuoso/src/main/accountStore.js) → `accountStore.ts`
- [`src/main/preload.js`](file:///Users/boblove/github/virtuoso/src/main/preload.js) → `preload.ts`
- [`tsconfig.json`](file:///Users/boblove/github/virtuoso/tsconfig.json)

**New Files:**
- `src/types/index.ts` - Shared type definitions
- `src/types/ipc.ts` - IPC channel type contracts

**Acceptance Criteria:**
- All main process files are TypeScript
- No TypeScript errors or warnings
- All IPC channels are type-safe
- Application builds and runs successfully

**Verification:**
- Run `npm run build` - should complete without errors
- Run `npm run dev` - app should start normally
- Test all features (add account, connect, send stanza, disconnect, remove)

---

### 5. Improve Error Handling & Validation
**Priority:** 🟡 HIGH  
**Estimate:** 4-6 hours

**Description:**  
Add comprehensive error handling, input validation, and user-friendly error messages throughout the application.

**Tasks:**
- [ ] Add XML validation before sending stanzas
- [ ] Add JID format validation
- [ ] Add port number validation (1-65535)
- [ ] Add proper error messages for connection failures
- [ ] Add timeout handling for connection attempts (30s)
- [ ] Add retry logic with exponential backoff
- [ ] Improve error display in UI (remove alert(), use toast notifications)
- [ ] Add React error boundaries

**Files to Modify:**
- [`src/main/xmppManager.ts`](file:///Users/boblove/github/virtuoso/src/main/xmppManager.js) - Add validation and retry logic
- [`src/renderer/App.tsx`](file:///Users/boblove/github/virtuoso/src/renderer/App.tsx) - Improve error display

**New Files:**
- `src/renderer/components/Toast.tsx` - Toast notification component
- `src/renderer/components/ErrorBoundary.tsx` - Error boundary component
- `src/utils/validation.ts` - Validation utility functions

**Acceptance Criteria:**
- Invalid XML shows clear error message (not crash)
- Invalid JID format is rejected with helpful message
- Connection errors display user-friendly messages
- Connection attempts timeout after 30 seconds
- Failed connections can be retried
- No more browser alert() dialogs

**Verification:**
- Try to send invalid XML - should show error, not crash
- Try to add account with invalid JID - should show validation error
- Try to connect to non-existent server - should timeout gracefully
- Disconnect network and try to connect - should show appropriate error

---

### 6. Fix Duplicate Form State Bug
**Priority:** 🟢 MEDIUM  
**Estimate:** 1 hour

**Description:**  
The App.tsx component has both `form` and `localForm` state variables that serve the same purpose. This is redundant and confusing.

**Tasks:**
- [ ] Remove `form` state variable
- [ ] Use only `localForm` for account form
- [ ] Update all references
- [ ] Test form functionality

**Files to Modify:**
- [`src/renderer/App.tsx`](file:///Users/boblove/github/virtuoso/src/renderer/App.tsx)

**Acceptance Criteria:**
- Only one form state variable exists
- Account creation works identically
- Code is cleaner and easier to understand

**Verification:**
- Add a new account using the form
- Verify all fields work correctly
- Verify form clears after submission

---

### 7. Basic UI Improvements
**Priority:** 🟢 MEDIUM  
**Estimate:** 6-8 hours

**Description:**  
Implement quick visual improvements that significantly enhance the look and feel of Virtuoso without major architectural changes.

**Tasks:**
- [ ] Create CSS file (replace inline styles)
- [ ] Import Google Font (Inter or Roboto)
- [ ] Define color palette (professional blues/grays)
- [ ] Add consistent spacing using CSS variables
- [ ] Improve button styles with hover effects
- [ ] Add icons for common actions (using react-icons)
- [ ] Improve form styling (labels, better inputs, validation feedback)
- [ ] Add loading states (spinners)
- [ ] Style the connection toggle switch better
- [ ] Add visual feedback for successful actions

**Dependencies to Add:**
- `react-icons` - Icon library
- `react-hot-toast` - Toast notifications

**Files to Modify:**
- [`src/renderer/App.tsx`](file:///Users/boblove/github/virtuoso/src/renderer/App.tsx) - Remove inline styles, use classes
- [`src/renderer/index.html`](file:///Users/boblove/github/virtuoso/src/renderer/index.html) - Add Google Font link

**New Files:**
- `src/renderer/styles/index.css` - Main stylesheet
- `src/renderer/styles/variables.css` - CSS custom properties

**Acceptance Criteria:**
- Modern, professional font (not browser default)
- Cohesive color scheme throughout
- Buttons have hover effects
- Icons add visual clarity
- UI looks polished and modern
- Consistent spacing and alignment

**Verification:**
- Visual inspection - app should look significantly better
- All buttons should have hover states
- All actions should show loading states
- Color scheme should be harmonious

---

### 8. Fix Account Status Synchronization
**Priority:** 🟢 MEDIUM  
**Estimate:** 3-4 hours

**Description:**  
Account status in the UI may not accurately reflect the actual XMPP connection state. The status should be synchronized from the backend.

**Tasks:**
- [ ] Ensure status updates are reliably sent from main to renderer
- [ ] Handle all XMPP status events (connecting, connected, disconnecting, disconnected, error)
- [ ] Update UI to show all status states clearly
- [ ] Add status change animations/transitions
- [ ] Add last activity timestamp
- [ ] Handle reconnection scenarios

**Files to Modify:**
- [`src/main/xmppManager.ts`](file:///Users/boblove/github/virtuoso/src/main/xmppManager.js)
- [`src/main/main.ts`](file:///Users/boblove/github/virtuoso/src/main/main.js)
- [`src/renderer/App.tsx`](file:///Users/boblove/github/virtuoso/src/renderer/App.tsx)

**Acceptance Criteria:**
- UI always reflects actual connection state
- "Connecting" state is visible (not just connected/disconnected)
- Error states are clearly displayed
- Status updates are reliable even with network issues

**Verification:**
- Connect account - status should show "connecting" then "connected"
- Disconnect account - status should update immediately
- Kill XMPP server while connected - should show error state
- Reconnect - should show status transitions

---

### 9. Improve Memory Management
**Priority:** 🟢 MEDIUM  
**Estimate:** 2-3 hours

**Description:**  
Fix potential memory leaks from event listeners and ensure proper cleanup when accounts are removed or app is closed.

**Tasks:**
- [ ] Ensure all XMPP event listeners are removed when account is removed
- [ ] Clean up IPC listeners properly
- [ ] Add cleanup on app quit
- [ ] Remove global state usage (refactor `global.stanzaSenders`)
- [ ] Use WeakMap for sender tracking if needed

**Files to Modify:**
- [`src/main/xmppManager.ts`](file:///Users/boblove/github/virtuoso/src/main/xmppManager.js)
- [`src/main/main.ts`](file:///Users/boblove/github/virtuoso/src/main/main.js)

**Acceptance Criteria:**
- No memory leaks when adding/removing accounts
- All listeners properly cleaned up on account removal
- No warnings about accessing destroyed webContents

**Verification:**
- Add and remove multiple accounts
- Check memory usage (should not continuously grow)
- Check console for any warnings about destroyed objects

---

## 🎨 UI Preview

After Phase 1, the UI should have:
- ✅ Professional typography (Google Font)
- ✅ Cohesive color scheme
- ✅ Improved button styles
- ✅ Icons for visual clarity
- ✅ Toast notifications instead of alerts
- ✅ Loading states for async actions
- ✅ Better connection status indicators

## 📦 Dependencies to Add

```json
{
  "dependencies": {
    "electron-store": "^8.1.0",
    "ltx": "^3.0.0",
    "react-icons": "^4.12.0",
    "react-hot-toast": "^2.4.1"
  },
  "devDependencies": {
    "@types/ltx": "^2.17.0"
  }
}
```

## 🧪 Testing Checklist

Before completing Phase 1, verify:
- [ ] Can add new account with encrypted password
- [ ] Can connect to XMPP server
- [ ] Can send XML stanzas
- [ ] Can receive stanza responses
- [ ] Can disconnect account
- [ ] Can remove account
- [ ] Invalid XML shows error (doesn't crash)
- [ ] Connection errors are user-friendly
- [ ] UI looks modern and polished
- [ ] No console errors or warnings
- [ ] accounts.json is not tracked by git
- [ ] TypeScript compilation succeeds

## 📝 Notes

- This phase should be completed before moving to Phase 2
- All critical bugs must be fixed for a stable foundation
- TypeScript migration will significantly speed up future development
- UI improvements will make the app more appealing for demos/screenshots

## 🚀 Next Phase

After completing Phase 1, proceed to [Phase 2: Core Features](file:///Users/boblove/github/virtuoso/docs/phase-2-implementation.md)
