/**
 * Account Store
 * Manages storage and retrieval of XMPP account credentials
 * Supports both development accounts (accounts.json) and UI-added accounts (encrypted store)
 */

import fs from 'fs';
import path from 'path';
import Store from 'electron-store';
import type { AccountData, AccountInfo, AccountRecord } from '../types/account';

const ACCOUNTS_FILE = path.join(__dirname, '../../accounts.json');

// Initialize encrypted store for UI-added accounts
const store = new Store<{ accounts: AccountRecord }>({
  name: 'accounts-encrypted',
  encryptionKey: 'virtuoso-dev-key-change-in-production', // In production, use a secure key
  clearInvalidConfig: true,
});

/**
 * Load accounts from both sources:
 * 1. Development accounts from accounts.json (plain text)
 * 2. UI-added accounts from encrypted store
 */
export function loadAccounts(): Record<string, AccountInfo> {
  const accounts: Record<string, AccountInfo> = {};

  // Load from accounts.json (development mode)
  try {
    if (fs.existsSync(ACCOUNTS_FILE)) {
      const data = fs.readFileSync(ACCOUNTS_FILE, 'utf-8');
      const devAccounts: AccountRecord = JSON.parse(data);
      // Mark these as development accounts
      for (const [id, account] of Object.entries(devAccounts)) {
        accounts[id] = { ...account, _source: 'dev' };
      }
      console.log(
        `[AccountStore] Loaded ${Object.keys(devAccounts).length} accounts from accounts.json`
      );
    }
  } catch (err) {
    console.error('[AccountStore] Failed to load accounts.json:', err);
  }

  // Load from encrypted store (UI-added accounts)
  try {
    const uiAccounts = store.get('accounts', {});
    for (const [id, account] of Object.entries(uiAccounts)) {
      accounts[id] = { ...account, _source: 'ui' };
    }
    console.log(
      `[AccountStore] Loaded ${Object.keys(uiAccounts).length} accounts from encrypted store`
    );
  } catch (err) {
    console.error('[AccountStore] Failed to load encrypted accounts:', err);
  }

  return accounts;
}

/**
 * Save an account
 * - If it came from dev (accounts.json), keep it there
 * - If it's new or from UI, save to encrypted store
 */
export function saveAccount(
  accountId: string,
  accountData: AccountData,
  source: 'dev' | 'ui' = 'ui'
): void {
  try {
    if (source === 'dev') {
      // Don't modify accounts.json - it's for manual editing only
      console.log(
        `[AccountStore] Skipping save for dev account: ${accountId} (edit accounts.json manually)`
      );
      return;
    }

    // Save UI-added accounts to encrypted store
    const uiAccounts = store.get('accounts', {});
    uiAccounts[accountId] = accountData;
    store.set('accounts', uiAccounts);
    console.log(`[AccountStore] Saved account ${accountId} to encrypted store`);
  } catch (err) {
    console.error('[AccountStore] Failed to save account:', err);
  }
}

/**
 * Save multiple accounts (legacy support)
 * This splits them by source and saves accordingly
 */
export function saveAccounts(accounts: Record<string, AccountInfo>): void {
  const devAccounts: AccountRecord = {};
  const uiAccounts: AccountRecord = {};

  for (const [id, account] of Object.entries(accounts)) {
    const { _source, ...accountData } = account;
    if (_source === 'dev') {
      devAccounts[id] = accountData;
    } else {
      uiAccounts[id] = accountData;
    }
  }

  // Don't modify accounts.json automatically
  if (Object.keys(devAccounts).length > 0) {
    console.log(
      `[AccountStore] Skipping save for ${Object.keys(devAccounts).length} dev accounts`
    );
  }

  // Save UI accounts to encrypted store
  if (Object.keys(uiAccounts).length > 0) {
    try {
      store.set('accounts', uiAccounts);
      console.log(
        `[AccountStore] Saved ${Object.keys(uiAccounts).length} UI accounts to encrypted store`
      );
    } catch (err) {
      console.error('[AccountStore] Failed to save UI accounts:', err);
    }
  }
}

/**
 * Remove an account
 */
export function removeAccount(accountId: string, source: 'dev' | 'ui' = 'ui'): boolean {
  try {
    if (source === 'dev') {
      console.log(
        `[AccountStore] Cannot remove dev account via code: ${accountId} (edit accounts.json manually)`
      );
      return false;
    }

    const uiAccounts = store.get('accounts', {});
    delete uiAccounts[accountId];
    store.set('accounts', uiAccounts);
    console.log(`[AccountStore] Removed account ${accountId} from encrypted store`);
    return true;
  } catch (err) {
    console.error('[AccountStore] Failed to remove account:', err);
    return false;
  }
}
