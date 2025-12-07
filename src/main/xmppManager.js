// Account and XMPP connection manager for Virtuoso
const { client, xml } = require('@xmpp/client');
const { loadAccounts, saveAccount, removeAccount: removeAccountFromStore } = require('./accountStore');
const ltx = require('ltx');

class XMPPManager {
  constructor() {
    this.accounts = {};
    this.accountData = loadAccounts();
  }

  addAccount(accountId, { jid, password, host, port, connectionMethod, _source }) {
    // Determine if this is a dev account (from accounts.json) or UI account
    const source = _source || 'ui'; // Default to 'ui' for new accounts

    // Save to appropriate storage
    const accountInfo = { jid, password, host, port, connectionMethod };
    saveAccount(accountId, accountInfo, source);

    // Update in-memory data with source tracking
    this.accountData[accountId] = { ...accountInfo, _source: source };
    console.log(`[XMPP] addAccount called: accountId=${accountId}, jid=${jid}, host=${host}, port=${port}, method=${connectionMethod || 'auto'}`);
    if (this.accounts[accountId]) {
      throw new Error('Account already exists');
    }
    const username = jid.includes('@') ? jid.split('@')[0] : jid;
    console.log(`[XMPP] Extracted username: ${username}`);

    // Determine connection protocol
    // Auto: Use xmpps for port 5223 (Direct TLS), xmpp for 5222 (STARTTLS)
    let protocol;
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
      rejectUnauthorized: false // Allow self-signed certificates (OpenFire default)
    };

    const xmpp = client({
      service: `${protocol}://${host}:${port}`,
      domain: host,
      resource: 'virtuoso',
      username,
      password,
      // Apply TLS options for all encrypted connections (both STARTTLS and Direct TLS)
      // Only skip TLS options if explicitly using 'plain' connection
      ...(connectionMethod !== 'plain' ? { tls: tlsOptions } : {})
    });
    console.log(`[XMPP] Applied TLS options: ${connectionMethod !== 'plain'}`);
    console.log(`[XMPP] XMPP client created for ${accountId}`);
    xmpp.on('error', err => {
      console.error(`[XMPP][${accountId}] Connection error:`, err);
      if (this.accounts[accountId].onStatus) {
        this.accounts[accountId].onStatus('error');
      }
    });
    xmpp.on('status', status => {
      console.log(`[XMPP][${accountId}] Status:`, status);
      if (this.accounts[accountId].onStatus) {
        this.accounts[accountId].onStatus(status);
      }
    });
    xmpp.on('online', address => {
      console.log(`[XMPP][${accountId}] Connected as:`, address.toString());
      if (this.accounts[accountId].onStatus) {
        this.accounts[accountId].onStatus('connected');
      }
    });
    xmpp.on('offline', () => {
      console.log(`[XMPP][${accountId}] Disconnected.`);
      if (this.accounts[accountId].onStatus) {
        this.accounts[accountId].onStatus('disconnected');
      }
    });
    // Attach stanza listener once per account
    this.accounts[accountId] = { xmpp, jid, password, host, port, onStanza: null };
    xmpp.on('stanza', stanza => {
      const acc = this.accounts[accountId];
      if (acc && acc.onStanza) {
        acc.onStanza(stanza);
      }
    });
    console.log(`[XMPP] Account ${accountId} added to manager`);
    return xmpp;
  }

  connect(accountId) {
    console.log(`[XMPP] connect() called for ${accountId}`);
    const account = this.accounts[accountId];
    if (!account) {
      console.error(`[XMPP] Account ${accountId} not found`);
      throw new Error('Account not found');
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

  sendStanza(accountId, xmlString) {
    const account = this.accounts[accountId];
    if (!account) throw new Error('Account not found');
    // Only send if client is online/connected
    const status = account.xmpp.status;
    if (!(status === 'online' || status === 'open' || status === 'connected')) {
      throw new Error('Account is not connected');
    }
    let stanza;
    try {
      // Parse raw XML string using ltx
      stanza = ltx.parse(xmlString.trim()); // Ensure no stray characters
      console.log(`[XMPP] Sending stanza:`, stanza.toString());
    } catch (err) {
      console.error(`[XMPP] XML parse error:`, err.message);
      throw new Error('Invalid XML stanza: ' + err.message);
    }
    account.xmpp.send(stanza);
  }

  onMessage(accountId, callback) {
    const account = this.accounts[accountId];
    if (!account) throw new Error('Account not found');
    // Just set the callback - listener is already attached from addAccount
    account.onStanza = callback;
  }

  onStatus(accountId, callback) {
    const account = this.accounts[accountId];
    if (!account) throw new Error('Account not found');
    account.onStatus = callback;
  }

  disconnect(accountId) {
    const account = this.accounts[accountId];
    if (!account) throw new Error('Account not found');
    return account.xmpp.stop().catch(console.error);
  }

  async removeAccount(accountId) {
    const source = this.accountData[accountId]?._source || 'ui';

    // Disconnect first and wait for it to complete
    try {
      const account = this.accounts[accountId];
      if (account && account.xmpp) {
        await account.xmpp.stop();
      }
    } catch (err) {
      console.error(`[XMPP] Error disconnecting account ${accountId}:`, err);
    }

    // Now safely remove from storage and memory
    removeAccountFromStore(accountId, source);
    delete this.accounts[accountId];
    delete this.accountData[accountId];
  }

  removeMessageListener(accountId, listener) {
    const account = this.accounts[accountId];
    if (!account) throw new Error('Account not found');
    account.xmpp.removeListener('stanza', listener);
  }
}

module.exports = XMPPManager;
