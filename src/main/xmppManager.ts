/**
 * XMPP Manager
 * Handles XMPP connections, message sending, and event management for multiple accounts
 */

import { client, xml } from '@xmpp/client';
import ltx from 'ltx';
import type { Element } from 'ltx';
import type { AccountData, AccountInfo } from '../types/account';
import type { XMPPAccount, XMPPAccounts, XMPPConfig } from '../types/xmpp';
import { loadAccounts, saveAccount, removeAccount as removeAccountFromStore } from './accountStore';

export class XMPPManager {
  private accounts: XMPPAccounts = {};
  private accountData: Record<string, AccountInfo>;

  constructor() {
    this.accountData = loadAccounts();
  }

  /**
   * Add a new XMPP account to the manager
   */
  addAccount(
    accountId: string,
    {
      jid,
      password,
      host,
      port,
      connectionMethod,
      _source,
    }: AccountData & { _source?: 'dev' | 'ui' }
  ): void {
    // Determine if this is a dev account (from accounts.json) or UI account
    const source = _source || 'ui'; // Default to 'ui' for new accounts

    // Save to appropriate storage - only include optional properties if defined
    const accountInfo: AccountData = { 
      jid, 
      password,
      ...(host !== undefined && { host }),
      ...(port !== undefined && { port }),
      ...(connectionMethod !== undefined && { connectionMethod })
    };
    saveAccount(accountId, accountInfo, source);

    // Update in-memory data with source tracking
    this.accountData[accountId] = { ...accountInfo, _source: source };

    console.log(
      `[XMPP] addAccount called: accountId=${accountId}, jid=${jid}, host=${host}, port=${port}, method=${connectionMethod || 'auto'}`
    );

    if (this.accounts[accountId]) {
      throw new Error('Account already exists');
    }

    const username = jid.includes('@') ? jid.split('@')[0] : jid;
    console.log(`[XMPP] Extracted username: ${username || ''}`);

    // Determine connection protocol
    // Auto: Use xmpps for port 5223 (Direct TLS), xmpp for 5222 (STARTTLS)
    let protocol: string;
    if (connectionMethod === 'direct-tls') {
      protocol = 'xmpps';
    } else if (connectionMethod === 'plain') {
      protocol = 'xmpp';
    } else {
      // Auto-detect based on port
      protocol = port === '5223' ? 'xmpps' : 'xmpp';
    }

    console.log(`[XMPP] Using protocol: ${protocol}`);

    // TLS options - accept self-signed certificates for development
    // In production, you should use properly signed certificates
    const tlsOptions = {
      rejectUnauthorized: false, // Allow self-signed certificates (OpenFire default)
    };

    const config: XMPPConfig = {
      service: `${protocol}://${host || jid.split('@')[1]}:${port || '5222'}`,
      domain: (host || jid.split('@')[1]) as string,
      resource: 'virtuoso',
      username: username || jid,
      password,
      // Apply TLS options for all encrypted connections (both STARTTLS and Direct TLS)
      // Only skip TLS options if explicitly using 'plain' connection
      ...(connectionMethod !== 'plain' ? { tls: tlsOptions } : {}),
    };

    const xmpp = client(config);
    console.log(`[XMPP] Applied TLS options: ${connectionMethod !== 'plain'}`);
    console.log(`[XMPP] XMPP client created for ${accountId}`);

    // Store listener references for cleanup
    const errorListener = (err: Error) => {
      console.error(`[XMPP][${accountId}] Connection error:`, err);
      if (this.accounts[accountId]?.onStatus) {
        this.accounts[accountId].onStatus!('error');
      }
    };

    const statusListener = (status: string) => {
      console.log(`[XMPP][${accountId}] Status:`, status);
      if (this.accounts[accountId]?.onStatus) {
        this.accounts[accountId].onStatus!(status);
      }
    };

    const onlineListener = (address: any) => {
      console.log(`[XMPP][${accountId}] Connected as:`, address.toString());
      if (this.accounts[accountId]?.onStatus) {
        this.accounts[accountId].onStatus!('connected');
      }
    };

    const offlineListener = () => {
      console.log(`[XMPP][${accountId}] Disconnected.`);
      if (this.accounts[accountId]?.onStatus) {
        this.accounts[accountId].onStatus!('disconnected');
      }
    };

    const stanzaListener = (stanza: Element) => {
      console.log(`[XMPP][${accountId}] Stanza:`, stanza.toString());
      if (this.accounts[accountId]?.onStanza) {
        this.accounts[accountId].onStanza!(stanza.toString());
      }
    };

    xmpp.on('error', errorListener);
    xmpp.on('status', statusListener);
    xmpp.on('online', onlineListener);
    xmpp.on('offline', offlineListener);
    xmpp.on('stanza', stanzaListener);

    this.accounts[accountId] = {
      xmpp,
      onStanza: null,
      onStatus: null,
      // Store listeners for cleanup
      listeners: { errorListener, statusListener, onlineListener, offlineListener, stanzaListener },
    };

    console.log(`[XMPP] Account ${accountId} added to manager`);
  }

  /**
   * Connect an account to the XMPP server
   * If the account hasn't been added yet but exists in stored credentials, add it first
   */
  connect(accountId: string): void {
    console.log(`[XMPP] connect() called for ${accountId}`);
    let account = this.accounts[accountId];

    // Auto-add account from stored credentials if not already added
    if (!account) {
      const storedData = this.accountData[accountId];
      if (storedData) {
        console.log(`[XMPP] Account ${accountId} not in manager but found in stored data, adding now`);
        this.addAccount(accountId, storedData);
        account = this.accounts[accountId];
      } else {
        console.error(`[XMPP] Account ${accountId} not found in manager or stored data`);
        throw new Error('Account not found');
      }
    }

    // TypeScript doesn't know addAccount ensures account exists, so check again
    if (!account) {
      throw new Error('Failed to add account');
    }

    // Prevent repeated connect attempts
    const status = account.xmpp.status;
    if (status === 'connecting' || status === 'connected' || status === 'online' || status === 'open') {
      console.warn(`[XMPP] Account ${accountId} is already connecting or connected.`);
      return;
    }

    console.log(`[XMPP] Starting connection for ${accountId}...`);
    account.xmpp.start().catch(console.error);
    console.log(`[XMPP] start() called for ${accountId}`);
  }

  /**
   * Send an XMPP stanza
   */
  sendStanza(accountId: string, xmlString: string): void {
    const account = this.accounts[accountId];

    if (!account) {
      throw new Error('Account not found');
    }

    // Only send if client is online/connected
    const status = account.xmpp.status;
    if (!(status === 'online' || status === 'open' || status === 'connected')) {
      throw new Error('Account is not connected');
    }

    let stanza: Element;
    try {
      // Parse raw XML string using ltx
      stanza = ltx.parse(xmlString.trim()); // Ensure no stray characters
      console.log(`[XMPP] Sending stanza:`, stanza.toString());
    } catch (err) {
      const error = err as Error;
      console.error(`[XMPP] XML parse error:`, error.message);
      throw new Error('Invalid XML stanza: ' + error.message);
    }

    account.xmpp.send(stanza);
  }

  /**
   * Register a callback for incoming messages
   */
  onMessage(accountId: string, callback: (stanza: string) => void): void {
    const account = this.accounts[accountId];

    if (!account) {
      throw new Error('Account not found');
    }

    // Just set the callback - listener is already attached from addAccount
    account.onStanza = callback;
  }

  /**
   * Register a callback for connection status changes
   */
  onStatus(accountId: string, callback: (status: string) => void): void {
    const account = this.accounts[accountId];

    if (!account) {
      throw new Error('Account not found');
    }

    account.onStatus = callback;
  }

  /**
   * Disconnect an account
   */
  disconnect(accountId: string): Promise<void> {
    const account = this.accounts[accountId];

    if (!account) {
      throw new Error('Account not found');
    }

    return account.xmpp.stop().catch(console.error);
  }

  /**
   * Remove an account completely
   */
  async removeAccount(accountId: string): Promise<void> {
    const source = this.accountData[accountId]?._source || 'ui';
    const account = this.accounts[accountId];

    // First, clear the callbacks so no more events fire to renderer
    if (account) {
      account.onStanza = null;
      account.onStatus = null;
    }

    // Remove from our accounts map BEFORE stopping to prevent any callbacks
    // from trying to access the account during shutdown
    delete this.accounts[accountId];
    delete this.accountData[accountId];

    // Now disconnect and clean up
    try {
      if (account && account.xmpp) {
        // Remove all event listeners FIRST to prevent any callbacks during shutdown
        if (account.listeners) {
          const { errorListener, statusListener, onlineListener, offlineListener, stanzaListener } =
            account.listeners;
          account.xmpp.removeListener('error', errorListener);
          account.xmpp.removeListener('status', statusListener);
          account.xmpp.removeListener('online', onlineListener);
          account.xmpp.removeListener('offline', offlineListener);
          account.xmpp.removeListener('stanza', stanzaListener);
          console.log(`[XMPP] Removed event listeners for ${accountId}`);
        }

        // CRITICAL: Destroy the underlying socket immediately to prevent
        // the @xmpp/connection crash where _onData tries to write to null parser.
        // This is more aggressive than stop() but prevents race conditions.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const socket = (account.xmpp as any).socket;
        if (socket) {
          // Remove all socket listeners first
          socket.removeAllListeners();
          // Destroy the socket immediately - this prevents any more data events
          socket.destroy();
          console.log(`[XMPP] Socket destroyed for ${accountId}`);
        }

        // Now we can safely stop (it will handle the null socket gracefully)
        try {
          await Promise.race([
            account.xmpp.stop().catch(() => {}), // Ignore errors since socket is destroyed
            new Promise(resolve => setTimeout(resolve, 500)) // Short timeout
          ]);
        } catch {
          // Ignore - socket is already destroyed
        }
      }
    } catch (err) {
      console.error(`[XMPP] Error disconnecting account ${accountId}:`, err);
    }

    // Remove from storage
    removeAccountFromStore(accountId, source);
    console.log(`[XMPP] Account ${accountId} fully removed`);
  }

  /**
   * Remove a message listener
   */
  removeMessageListener(accountId: string, listener: (stanza: Element) => void): void {
    const account = this.accounts[accountId];

    if (!account) {
      throw new Error('Account not found');
    }

    account.xmpp.removeListener('stanza', listener);
  }
}
