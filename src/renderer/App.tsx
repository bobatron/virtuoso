import React, { useState, useEffect } from 'react';

declare global {
  interface Window {
    electron?: {
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      send: (channel: string, ...args: any[]) => void;
      on: (channel: string, callback: (...args: any[]) => void) => void;
      off: (channel: string, callback: (...args: any[]) => void) => void;
    };
  }
}

type Account = {
  id: string;
  jid: string;
  password: string;
  host: string;
  port: string;
  status: string;
};

const App: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [responses, setResponses] = useState<{ accountId: string, stanza: string }[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [sendStatus, setSendStatus] = useState<string | null>(null);
  const [selectedResponse, setSelectedResponse] = useState<number | null>(null);
  const [localForm, setLocalForm] = useState({ id: '', jid: '', password: '', host: '', port: '5222', connectionMethod: 'auto' });
  const [message, setMessage] = useState('');

  // Load accounts from backend on mount
  useEffect(() => {
    // Load accounts from backend on mount
    // @ts-ignore
    window.electron?.invoke('get-accounts').then((data) => {
      if (data) {
        const loaded = Object.entries(data).map(([id, acc]) => {
          const a = acc as { jid?: string; password?: string; host?: string; port?: string };
          return {
            id,
            jid: a.jid || '',
            password: a.password || '',
            host: a.host || '',
            port: a.port || '',
            status: 'disconnected'
          };
        });
        setAccounts(loaded);
      }
    });
  }, []);

  // Memoized stanzaListener to avoid duplicate subscriptions
  const stanzaListener = React.useCallback((_event: any, accountId: string, stanza: string) => {
    setResponses(prev => [...prev, { accountId, stanza }]);
  }, []);

  // Memoized statusListener to update account status
  const statusListener = React.useCallback((_event: any, accountId: string, status: string) => {
    console.log(`[UI] Status update for ${accountId}: ${status}`);
    setAccounts(prev =>
      prev.map(acc =>
        acc.id === accountId ? { ...acc, status } : acc
      )
    );
  }, []);

  // Track if listener is registered to prevent duplicates from React Strict Mode
  const listenerRegisteredRef = React.useRef(false);

  // Only register stanza and status listeners once on mount
  useEffect(() => {
    if (listenerRegisteredRef.current) return;
    listenerRegisteredRef.current = true;
    window.electron?.on('stanza-response', stanzaListener);
    window.electron?.on('account-status', statusListener);
    return () => {
      listenerRegisteredRef.current = false;
      window.electron?.off('stanza-response', stanzaListener);
      window.electron?.off('account-status', statusListener);
    };
  }, [stanzaListener, statusListener]);

  // Track subscribed accounts across renders
  const subscribedRef = React.useRef<Set<string>>(new Set());

  // Subscribe to stanza and status events for all accounts (only subscribe once per account)
  useEffect(() => {
    accounts.forEach(acc => {
      if (!subscribedRef.current.has(acc.id)) {
        window.electron?.send('subscribe-stanza', acc.id);
        subscribedRef.current.add(acc.id);
      }
    });
  }, [accounts]);

  const handleLocalChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setLocalForm({ ...localForm, [e.target.name]: e.target.value });
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localForm.id || !localForm.jid || !localForm.password || !localForm.host || !localForm.port) return;
    const result = await window.electron?.invoke('add-account', localForm.id, localForm);
    if (result?.success) {
      setAccounts([...accounts, { ...localForm, status: 'disconnected' }]);
      setLocalForm({ id: '', jid: '', password: '', host: '', port: '5222', connectionMethod: 'auto' });
    } else {
      alert(result?.error || 'Failed to add account');
    }
  };

  const handleConnect = async (id: string) => {
    // Don't set status here - let the backend status events handle it
    // This prevents showing 'connected' when the connection actually failed
    // @ts-ignore
    await window.electron?.invoke('connect-account', id);
  };

  const handleDisconnect = async (id: string) => {
    // Don't set status here - let the backend status events handle it
    // @ts-ignore
    await window.electron?.invoke('disconnect-account', id);
  };

  const handleRemove = async (id: string) => {
    // @ts-ignore
    const result = await window.electron?.invoke('remove-account', id);
    if (result?.success) {
      setAccounts(accs => accs.filter(acc => acc.id !== id));
    } else {
      alert(result?.error || 'Failed to remove account');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount || !message) return;
    // @ts-ignore
    const result = await window.electron?.invoke('send-stanza', selectedAccount, message);
    setSendStatus(result?.success ? 'Message sent!' : `Error: ${result?.error || 'Failed to send'}`);
    setTimeout(() => setSendStatus(null), 3000);
  };

  // Sidebar: accounts + status icon + toggle
  const Sidebar = () => (
    <div style={{ width: 180, background: '#f4f4f4', padding: '1rem', borderRight: '1px solid #ccc', height: '100vh', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>
      <button style={{ width: '100%', maxWidth: '100%', marginBottom: '1rem', fontWeight: 'bold', background: '#1976d2', color: 'white', border: 'none', borderRadius: 4, padding: '0.75rem', cursor: 'pointer', boxSizing: 'border-box' }} onClick={() => { setShowAddForm(true); setSelectedAccount(null); }}>+ Add XMPP Account</button>
      <ul style={{ listStyle: 'none', padding: 0, flex: 1, overflowY: 'auto', width: '100%', margin: 0, boxSizing: 'border-box' }}>
        {accounts.map(acc => {
          // Determine status color and symbol
          const getStatusColor = (status: string) => {
            if (status === 'connected' || status === 'online') return '#4caf50'; // Green
            if (status === 'connecting' || status === 'opening' || status === 'connect') return '#ff9800'; // Orange
            if (status === 'error') return '#f44336'; // Red
            return '#9e9e9e'; // Gray
          };

          const getStatusSymbol = (status: string) => {
            if (status === 'connected' || status === 'online') return '✔️';
            if (status === 'connecting' || status === 'opening' || status === 'connect') return '⟳';
            if (status === 'error') return '⚠️';
            return '○';
          };

          return (
            <li key={acc.id} style={{ marginBottom: '1rem', background: selectedAccount === acc.id ? '#e3f2fd' : undefined, padding: '0.5rem', borderRadius: 4, width: '100%', boxSizing: 'border-box' }}>
              <div style={{ cursor: 'pointer' }} onClick={() => { setSelectedAccount(acc.id); setShowAddForm(false); setSelectedResponse(null); }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <strong style={{ wordBreak: 'break-all', flex: 1 }}>{acc.id}</strong>
                  <span title={acc.status} style={{ fontSize: 18 }}>{getStatusSymbol(acc.status)}</span>
                </div>
                <div style={{
                  fontSize: '0.75rem',
                  color: getStatusColor(acc.status),
                  textTransform: 'capitalize',
                  fontWeight: 500
                }}>
                  {acc.status}
                </div>
              </div>
              {/* Toggle switch for connect/disconnect */}
              <span style={{ marginLeft: 8 }}>
                <label style={{ display: 'inline-block', width: 36, height: 20, position: 'relative', maxWidth: '100%' }}>
                  <input
                    type="checkbox"
                    checked={acc.status === 'connected' || acc.status === 'online'}
                    disabled={acc.status === 'connecting' || acc.status === 'opening' || acc.status === 'connect'}
                    onChange={() => (acc.status === 'connected' || acc.status === 'online') ? handleDisconnect(acc.id) : handleConnect(acc.id)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, background: (acc.status === 'connected' || acc.status === 'online') ? '#43a047' : '#ccc', borderRadius: 20, transition: 'background 0.2s', width: 36, height: 20 }}></span>
                  <span style={{ position: 'absolute', left: (acc.status === 'connected' || acc.status === 'online') ? 18 : 2, top: 2, width: 16, height: 16, background: '#fff', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }}></span>
                </label>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );

  // Main content area
  const MainContent = () => {
    if (showAddForm) {
      return (
        <div style={{ padding: '2rem' }}>
          <h2>Add XMPP Account</h2>
          <form onSubmit={handleAddAccount} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 400 }}>
            <input name="id" placeholder="Account ID" value={localForm.id} onChange={handleLocalChange} required />
            <input name="jid" placeholder="JID (user@domain)" value={localForm.jid} onChange={handleLocalChange} required />
            <input name="password" type="password" placeholder="Password" value={localForm.password} onChange={handleLocalChange} required />
            <input name="host" placeholder="Host" value={localForm.host} onChange={handleLocalChange} required />
            <input name="port" placeholder="Port" value={localForm.port} onChange={handleLocalChange} required />
            <select name="connectionMethod" value={localForm.connectionMethod || 'auto'} onChange={handleLocalChange}>
              <option value="auto">Auto (STARTTLS on 5222, Direct TLS on 5223)</option>
              <option value="starttls">STARTTLS</option>
              <option value="direct-tls">Direct TLS</option>
              <option value="plain">Plain (No Encryption)</option>
            </select>
            <button type="submit">Add Account</button>
          </form>
        </div>
      );
    }
    if (selectedAccount) {
      const handleDeleteAccount = async () => {
        const confirmed = confirm(`Are you sure you want to delete the account "${selectedAccount}"?\n\nNote: Accounts from accounts.json will only be removed from the app, not from the file. Edit accounts.json manually to permanently delete them.`);
        if (!confirmed) return;

        // @ts-ignore
        const result = await window.electron?.invoke('remove-account', selectedAccount);
        if (result?.success) {
          setAccounts(accs => accs.filter(acc => acc.id !== selectedAccount));
          setSelectedAccount(null);
          setResponses([]); // Clear responses for deleted account
        } else {
          alert(result?.error || 'Failed to remove account');
        }
      };

      return (
        <div style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2>Send XML Stanza</h2>
            <button
              onClick={handleDeleteAccount}
              style={{
                background: '#d32f2f',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                padding: '0.5rem 1rem',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Delete Account
            </button>
          </div>
          <form onSubmit={handleSendMessage} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 400 }}>
            <textarea
              value={message}
              onChange={handleMessageChange}
              placeholder="Paste XML stanza here"
              rows={6}
              style={{ fontFamily: 'monospace' }}
              required
            />
            <button type="submit">Send Stanza</button>
            {sendStatus && <div style={{ color: sendStatus.startsWith('Error') ? 'red' : 'green' }}>{sendStatus}</div>}
          </form>
          <h2>Stanza Responses</h2>
          <button onClick={() => { setResponses(responses.filter(r => r.accountId !== selectedAccount)); setSelectedResponse(null); }} style={{ marginBottom: '0.5rem' }}>Clear Responses</button>
          <ul style={{ maxHeight: 200, overflowY: 'auto', background: '#f9f9f9', padding: '0.5rem', border: '1px solid #ccc' }}>
            {responses.filter(r => r.accountId === selectedAccount).map((resp, idx) => (
              <li key={idx} style={{ marginBottom: '0.5rem', cursor: 'pointer', background: selectedResponse === idx ? '#e0e0e0' : undefined }} onClick={() => setSelectedResponse(idx)}>
                <span style={{ color: '#555' }}>{resp.stanza.slice(0, 60)}{resp.stanza.length > 60 ? '...' : ''}</span>
              </li>
            ))}
            {responses.filter(r => r.accountId === selectedAccount).length === 0 && <li style={{ color: '#888' }}>No responses yet.</li>}
          </ul>
          {selectedResponse !== null && responses.filter(r => r.accountId === selectedAccount)[selectedResponse] && (
            <div style={{ background: '#f9f9f9', padding: '0.5rem', border: '1px solid #ccc', marginTop: '1rem' }}>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{responses.filter(r => r.accountId === selectedAccount)[selectedResponse]?.stanza ?? ''}</pre>
            </div>
          )}
        </div>
      );
    }
    return <div style={{ padding: '2rem', color: '#888' }}>Select an account or add a new one.</div>;
  };

  // Layout
  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {Sidebar()}
      <div style={{ flex: 1 }}>
        {MainContent()}
      </div>
    </div>
  );
};

export default App;
