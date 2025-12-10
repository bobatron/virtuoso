/// <reference types="jest" />
/**
 * Tests for XMPPManager class
 */

import { XMPPManager } from '../xmppManager';
import type { AccountData } from '../../types/account';

// Mock dependencies
jest.mock('@xmpp/client');
jest.mock('ltx');
jest.mock('../accountStore');

describe('XMPPManager', () => {
  let manager: XMPPManager;
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock XMPP client
    const { client } = require('@xmpp/client');
    mockClient = {
      on: jest.fn(),
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      send: jest.fn(),
      removeListener: jest.fn(),
      status: 'offline',
    };
    client.mockReturnValue(mockClient);

    // Mock accountStore
    const accountStore = require('../accountStore');
    accountStore.loadAccounts.mockReturnValue({});
    accountStore.saveAccount.mockImplementation(() => {});

    manager = new XMPPManager();
  });

  describe('addAccount', () => {
    it('should add a new account with proper configuration', () => {
      const accountData: AccountData = {
        jid: 'alice@example.com',
        password: 'alice123',
        host: 'xmpp.example.com',
        port: '5222',
      };

      manager.addAccount('alice', accountData);

      const { client } = require('@xmpp/client');
      expect(client).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'xmpp://xmpp.example.com:5222',
          domain: 'xmpp.example.com',
          username: 'alice',
          password: 'alice123',
        })
      );
    });

    it('should throw error if account already exists', () => {
      const accountData: AccountData = {
        jid: 'alice@example.com',
        password: 'alice123',
      };

      manager.addAccount('alice', accountData);

      expect(() => {
        manager.addAccount('alice', accountData);
      }).toThrow('Account already exists');
    });

    it('should use direct TLS for port 5223', () => {
      const accountData: AccountData = {
        jid: 'alice@example.com',
        password: 'alice123',
        host: 'xmpp.example.com',
        port: '5223',
      };

      manager.addAccount('alice', accountData);

      const { client } = require('@xmpp/client');
      expect(client).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'xmpps://xmpp.example.com:5223',
        })
      );
    });

    it('should setup event listeners', () => {
      const accountData: AccountData = {
        jid: 'alice@example.com',
        password: 'alice123',
      };

      manager.addAccount('alice', accountData);

      expect(mockClient.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('status', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('online', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('offline', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('stanza', expect.any(Function));
    });
  });

  describe('connect', () => {
    it('should start XMPP connection', () => {
      const accountData: AccountData = {
        jid: 'alice@example.com',
        password: 'alice123',
      };

      manager.addAccount('alice', accountData);
      manager.connect('alice');

      expect(mockClient.start).toHaveBeenCalled();
    });

    it('should throw error for non-existent account', () => {
      expect(() => {
        manager.connect('nonexistent');
      }).toThrow('Account not found');
    });

    it('should not reconnect if already connecting', () => {
      const accountData: AccountData = {
        jid: 'alice@example.com',
        password: 'alice123',
      };

      mockClient.status = 'connecting';
      manager.addAccount('alice', accountData);
      manager.connect('alice');

      // start should not be called when already connecting
      expect(mockClient.start).not.toHaveBeenCalled();
    });
  });

  describe('sendStanza', () => {
    beforeEach(() => {
      mockClient.status = 'online';
    });

    it('should send valid XML stanza', () => {
      const accountData: AccountData = {
        jid: 'alice@example.com',
        password: 'alice123',
      };

      manager.addAccount('alice', accountData);

      const ltx = require('ltx');
      const mockStanza = { toString: () => '<message/>' };
      ltx.parse.mockReturnValue(mockStanza);

      manager.sendStanza('alice', '<message/>');

      expect(ltx.parse).toHaveBeenCalledWith('<message/>');
      expect(mockClient.send).toHaveBeenCalledWith(mockStanza);
    });

    it('should throw error for invalid XML', () => {
      const accountData: AccountData = {
        jid: 'alice@example.com',
        password: 'alice123',
      };

      manager.addAccount('alice', accountData);

      const ltx = require('ltx');
      ltx.parse.mockImplementation(() => {
        throw new Error('Invalid XML');
      });

      expect(() => {
        manager.sendStanza('alice', 'invalid xml');
      }).toThrow('Invalid XML stanza');
    });

    it('should throw error if account not connected', () => {
      const accountData: AccountData = {
        jid: 'alice@example.com',
        password: 'alice123',
      };

      mockClient.status = 'offline';
      manager.addAccount('alice', accountData);

      expect(() => {
        manager.sendStanza('alice', '<message/>');
      }).toThrow('Account is not connected');
    });
  });

  describe('disconnect', () => {
    it('should stop XMPP connection', async () => {
      const accountData: AccountData = {
        jid: 'alice@example.com',
        password: 'alice123',
      };

      manager.addAccount('alice', accountData);
      await manager.disconnect('alice');

      expect(mockClient.stop).toHaveBeenCalled();
    });

    it('should throw error for non-existent account', () => {
      expect(() => {
        manager.disconnect('nonexistent');
      }).toThrow('Account not found');
    });
  });

  describe('removeAccount', () => {
    it('should remove account and cleanup listeners', async () => {
      const accountData: AccountData = {
        jid: 'alice@example.com',
        password: 'alice123',
      };

      manager.addAccount('alice', accountData);
      await manager.removeAccount('alice');

      expect(mockClient.removeListener).toHaveBeenCalledTimes(5); // All event listeners
      expect(mockClient.stop).toHaveBeenCalled();
    });
  });

  describe('onMessage and onStatus', () => {
    it('should register message callback', () => {
      const accountData: AccountData = {
        jid: 'alice@example.com',
        password: 'alice123',
      };

      manager.addAccount('alice', accountData);

      const callback = jest.fn();
      manager.onMessage('alice', callback);

      // Trigger the stanza listener
      const stanzaListener = mockClient.on.mock.calls.find(
        (call: any[]) => call[0] === 'stanza'
      )?.[1];
      const mockStanza = { toString: () => '<message/>' };
      stanzaListener(mockStanza);

      expect(callback).toHaveBeenCalledWith('<message/>');
    });

    it('should register status callback', () => {
      const accountData: AccountData = {
        jid: 'alice@example.com',
        password: 'alice123',
      };

      manager.addAccount('alice', accountData);

      const callback = jest.fn();
      manager.onStatus('alice', callback);

      // Trigger the status listener
      const statusListener = mockClient.on.mock.calls.find(
        (call: any[]) => call[0] === 'status'
      )?.[1];
      statusListener('connecting');

      expect(callback).toHaveBeenCalledWith('connecting');
    });
  });
});
