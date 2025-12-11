/**
 * Main Electron process
 * Handles window creation, IPC communication, and application lifecycle
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { XMPPManager } from './xmppManager';
import { loadAccounts } from './accountStore';
import { loadTemplates, saveTemplate, deleteTemplate } from './templateStore';
import type { AccountData } from '../types/account';
import type { Template } from '../types/template';
import type { IpcResponse } from '../types/ipc';

const xmppManager = new XMPPManager();

// Track the current renderer's webContents for sending stanza responses
let mainWindow: BrowserWindow | null = null;

// Global state for stanza subscriptions
interface GlobalState {
  stanzaSenders?: Record<string, Electron.WebContents>;
  stanzaSubscribed?: Record<string, boolean>;
}

const globalState: GlobalState = {};

// Forward stanza responses and status to renderer
ipcMain.on('subscribe-stanza', (event, accountId: string) => {
  console.log(`[IPC] subscribe-stanza called for ${accountId}`);
  
  // Always update the sender reference (handles hot reload)
  if (!globalState.stanzaSenders) globalState.stanzaSenders = {};
  globalState.stanzaSenders[accountId] = event.sender;

  // Only set up the callback once per account
  if (!globalState.stanzaSubscribed) globalState.stanzaSubscribed = {};
  if (globalState.stanzaSubscribed[accountId]) {
    console.log(`[IPC] Already subscribed to ${accountId}, skipping`);
    return;
  }
  globalState.stanzaSubscribed[accountId] = true;

  // Check if account exists in xmppManager before setting up callbacks
  try {
    xmppManager.onMessage(accountId, (stanza) => {
      const sender = globalState.stanzaSenders?.[accountId];
      if (sender && !sender.isDestroyed()) {
        sender.send('stanza-response', accountId, stanza);
      }
    });

    xmppManager.onStatus(accountId, (status) => {
      console.log(`[IPC] Sending status update to renderer: ${accountId} -> ${status}`);
      const sender = globalState.stanzaSenders?.[accountId];
      if (sender && !sender.isDestroyed()) {
        sender.send('account-status', accountId, status);
      }
    });
    console.log(`[IPC] Successfully subscribed to ${accountId}`);
  } catch (err) {
    console.log(`[IPC] Account ${accountId} not yet added to xmppManager, subscription deferred`);
    // Account doesn't exist yet - this is OK for loaded accounts that haven't been connected
    // The subscription will be set up when connect is called
    globalState.stanzaSubscribed[accountId] = false; // Allow retry later
  }
});

ipcMain.handle('get-accounts', () => {
  // Return all loaded accounts (without xmpp client objects)
  return loadAccounts();
});

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173'); // Vite dev server default port
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow = win;
}

// IPC handlers for account management and messaging
ipcMain.handle(
  'add-account',
  (event, accountId: string, accountData: AccountData): IpcResponse => {
    console.log(`[IPC] add-account handler called with accountId: ${accountId}`, accountData);
    try {
      xmppManager.addAccount(accountId, accountData);
      console.log(`[IPC] Account added successfully`);
      return { success: true };
    } catch (err) {
      const error = err as Error;
      console.error(`[IPC] Error adding account:`, error.message);
      return { success: false, error: error.message };
    }
  }
);

ipcMain.handle('connect-account', (event, accountId: string): IpcResponse => {
  console.log(`[IPC] connect-account handler called with accountId: ${accountId}`);
  try {
    xmppManager.connect(accountId);
    
    // Re-attempt subscription setup now that account exists in xmppManager
    // This handles the case where account was loaded from storage but not yet added
    if (globalState.stanzaSubscribed && !globalState.stanzaSubscribed[accountId]) {
      console.log(`[IPC] Setting up deferred subscription for ${accountId}`);
      try {
        xmppManager.onMessage(accountId, (stanza) => {
          const sender = globalState.stanzaSenders?.[accountId];
          if (sender && !sender.isDestroyed()) {
            sender.send('stanza-response', accountId, stanza);
          }
        });

        xmppManager.onStatus(accountId, (status) => {
          console.log(`[IPC] Sending status update to renderer: ${accountId} -> ${status}`);
          const sender = globalState.stanzaSenders?.[accountId];
          if (sender && !sender.isDestroyed()) {
            sender.send('account-status', accountId, status);
          }
        });
        globalState.stanzaSubscribed[accountId] = true;
        console.log(`[IPC] Deferred subscription set up for ${accountId}`);
      } catch (subErr) {
        console.error(`[IPC] Failed to set up deferred subscription:`, subErr);
      }
    }
    
    console.log(`[IPC] Connect request processed`);
    return { success: true };
  } catch (err) {
    const error = err as Error;
    console.error(`[IPC] Error connecting account:`, error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('send-stanza', (event, accountId: string, xmlString: string): IpcResponse => {
  try {
    xmppManager.sendStanza(accountId, xmlString);
    return { success: true };
  } catch (err) {
    const error = err as Error;
    return { success: false, error: error.message };
  }
});

ipcMain.handle('disconnect-account', (event, accountId: string): IpcResponse => {
  try {
    xmppManager.disconnect(accountId);
    return { success: true };
  } catch (err) {
    const error = err as Error;
    return { success: false, error: error.message };
  }
});

ipcMain.handle('remove-account', async (event, accountId: string): Promise<IpcResponse> => {
  try {
    // Clean up stanza subscription state
    if (globalState.stanzaSubscribed) {
      delete globalState.stanzaSubscribed[accountId];
    }
    if (globalState.stanzaSenders) {
      delete globalState.stanzaSenders[accountId];
    }
    await xmppManager.removeAccount(accountId);
    return { success: true };
  } catch (err) {
    const error = err as Error;
    return { success: false, error: error.message };
  }
});

// Template Management IPC
ipcMain.handle('get-templates', () => {
  return loadTemplates();
});

ipcMain.handle('save-template', (event, template: Template): IpcResponse => {
  try {
    const success = saveTemplate(template);
    if (success) return { success: true };
    return { success: false, error: 'Failed to save template' };
  } catch (err) {
    const error = err as Error;
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-template', (event, templateId: string): IpcResponse => {
  try {
    const success = deleteTemplate(templateId);
    if (success) return { success: true };
    return { success: false, error: 'Failed to delete template' };
  } catch (err) {
    const error = err as Error;
    return { success: false, error: error.message };
  }
});

app.whenReady().then(() => {
  // Load saved accounts and add to manager
  const savedAccounts = loadAccounts();
  for (const [id, data] of Object.entries(savedAccounts)) {
    try {
      xmppManager.addAccount(id, data);
      console.log(`[Main] Loaded account: ${id}`);
    } catch (err) {
      const error = err as Error;
      console.error(`[Main] Failed to load account ${id}:`, error.message);
    }
  }
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

console.log('[Main] Electron app started');
