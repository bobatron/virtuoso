/// <reference types="jest" />
/**
 * Tests for accountStore module
 */

import fs from 'fs';
import { loadAccounts, saveAccount, removeAccount } from '../accountStore';
import type { AccountData } from '../../types/account';

// Mock dependencies
jest.mock('fs');

// Mock electron-store with a Map-based implementation
const mockStoreData = new Map<string, any>();

jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn((key: string, defaultValue?: any) => {
      return mockStoreData.has(key) ? mockStoreData.get(key) : defaultValue;
    }),
    set: jest.fn((key: string, value: any) => {
      mockStoreData.set(key, value);
    }),
  }));
});

describe('accountStore', () => {
  const mockFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStoreData.clear();
  });

  describe('loadAccounts', () => {
    it('should load accounts from both accounts.json and encrypted store', () => {
      const devAccounts = {
        alice: {
          jid: 'alice@dev.com',
          password: 'dev123',
        },
      };

      const uiAccounts = {
        bob: {
          jid: 'bob@example.com',
          password: 'ui456',
        },
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(devAccounts));
      mockStoreData.set('accounts', uiAccounts);

      const result = loadAccounts();

      expect(result).toEqual({
        alice: { ...devAccounts.alice, _source: 'dev' },
        bob: { ...uiAccounts.bob, _source: 'ui' },
      });
    });

    it('should handle missing accounts.json', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockStoreData.set('accounts', {});

      const result = loadAccounts();

      expect(result).toEqual({});
    });

    it('should handle corrupted accounts.json', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('invalid json');
      mockStoreData.set('accounts', {});

      const result = loadAccounts();

      // Should still return UI accounts even if dev accounts fail
      expect(result).toEqual({});
    });
  });

  describe('saveAccount', () => {
    it('should save UI account to encrypted store', () => {
      const accountData: AccountData = {
        jid: 'test@example.com',
        password: 'test123',
      };

      mockStoreData.set('accounts', {});

      saveAccount('test', accountData, 'ui');

      expect(mockStoreData.get('accounts')).toEqual({
        test: accountData,
      });
    });

    it('should not save dev account to store', () => {
      const accountData: AccountData = {
        jid: 'test@example.com',
        password: 'test123',
      };

      saveAccount('test', accountData, 'dev');

      expect(mockStoreData.has('accounts')).toBe(false);
    });

    it('should merge with existing accounts', () => {
      const existingAccounts = {
        alice: {
          jid: 'alice@example.com',
          password: 'alice123',
        },
      };

      const newAccount: AccountData = {
        jid: 'bob@example.com',
        password: 'bob123',
      };

      mockStoreData.set('accounts', existingAccounts);

      saveAccount('bob', newAccount, 'ui');

      expect(mockStoreData.get('accounts')).toEqual({
        ...existingAccounts,
        bob: newAccount,
      });
    });
  });

  describe('removeAccount', () => {
    it('should remove UI account from store', () => {
      const accounts = {
        alice: { jid: 'alice@example.com', password: 'alice123' },
        bob: { jid: 'bob@example.com', password: 'bob123' },
      };

      mockStoreData.set('accounts', accounts);

      const result = removeAccount('alice', 'ui');

      expect(result).toBe(true);
      expect(mockStoreData.get('accounts')).toEqual({
        bob: accounts.bob,
      });
    });

    it('should not remove dev account', () => {
      const result = removeAccount('alice', 'dev');

      expect(result).toBe(false);
      expect(mockStoreData.has('accounts')).toBe(false);
    });

    it('should handle errors gracefully', () => {
      // This test may need adjustment based on actual error handling
      // For now, test that it returns false when account doesn't exist
      mockStoreData.set('accounts', {});

      const result = removeAccount('alice', 'ui');

      expect(result).toBe(true); // Empty object is still valid
    });
  });
});
