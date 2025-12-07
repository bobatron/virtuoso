import React, { useState, useEffect, FC } from 'react';
import toast from 'react-hot-toast';
import { FiPlus, FiTrash2, FiCheckCircle, FiAlertCircle, FiCircle, FiLoader } from 'react-icons/fi';
import './App.css';

interface Account {
  id: string;
  jid: string;
  password: string;
  host: string;
  port: string;
  status: string;
}

const App: FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [responses, setResponses] = useState<{ accountId: string, stanza: string }[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [sendStatus, setSendStatus] = useState<string | null>(null);
  const [selectedResponse, setSelectedResponse] = useState<number | null>(null);
  const [localForm, setLocalForm] = useState({ id: '', jid: '', password: '', host: '', port: '5222', connectionMethod: 'auto' });
  const [message, setMessage] = useState('');

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

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    // @ts-ignore
    const result = await window.electron?.invoke('add-account', localForm.id, {
      jid: localForm.jid,
      password: localForm.password,
      host: localForm.host,
      port: localForm.port,
      connectionMethod: localForm.connectionMethod
    });

    if (result?.success) {
      setAccounts([...accounts, { ...localForm, status: 'disconnected' }]);
      setLocalForm({ id: '', jid: '', password: '', host: '', port: '5222', connectionMethod: 'auto' });
      setShowAddForm(false);
      toast.success(`Account "${localForm.id}" added successfully`);
    } else {
      toast.error(result?.error || 'Failed to add account');
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
      toast.success(`Account "${id}" removed`);
    } else {
      toast.error(result?.error || 'Failed to remove account');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount || !message) return;
    // @ts-ignore
    const result = await window.electron?.invoke('send-stanza', selectedAccount, message);
    if (result?.success) {
      setSendStatus('Message sent!');
      toast.success('Stanza sent successfully');
    } else {
      setSendStatus(`Error: ${result?.error || 'Failed to send'}`);
      toast.error(result?.error || 'Failed to send stanza');
    }
    setTimeout(() => setSendStatus(null), 3000);
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
  };

  const getStatusColor = (status: string) => {
    if (status === 'connected' || status === 'online') return 'status-online';
    if (status === 'connecting' || status === 'opening' || status === 'connect') return 'status-connecting';
    if (status === 'error') return 'status-error';
    return 'status-offline';
  };

  const getStatusIcon = (status: string) => {
    if (status === 'connected' || status === 'online') return <FiCheckCircle />;
    if (status === 'connecting' || status === 'opening' || status === 'connect') return <FiLoader className="spinner" />;
    if (status === 'error') return <FiAlertCircle />;
    return <FiCircle />;
  };

  // Sidebar Component
  const Sidebar = () => (
    <div className="sidebar">
      <div className="sidebar-header">
        <button
          className="add-account-btn"
          onClick={() => { setShowAddForm(true); setSelectedAccount(null); }}
        >
          <FiPlus style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
          Add Account
        </button>
      </div>

      <ul className="accounts-list">
        {accounts.map(acc => {
          const isSelected = selectedAccount === acc.id;
          const isConnected = acc.status === 'connected' || acc.status === 'online';
          const isConnecting = acc.status === 'connecting' || acc.status === 'opening' || acc.status === 'connect';

          return (
            <li
              key={acc.id}
              className={`account-item ${isSelected ? 'selected' : ''}`}
            >
              <div onClick={() => { setSelectedAccount(acc.id); setShowAddForm(false); setSelectedResponse(null); }}>
                <div className="account-header">
                  <span className="account-name">{acc.id}</span>
                  <span className={`status-icon ${getStatusColor(acc.status)}`}>
                    {getStatusIcon(acc.status)}
                  </span>
                </div>
                <div className={`account-status ${getStatusColor(acc.status)}`}>
                  {acc.status}
                </div>
              </div>

              <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={isConnected}
                    disabled={isConnecting}
                    onChange={() => isConnected ? handleDisconnect(acc.id) : handleConnect(acc.id)}
                  />
                  <span className={`toggle-slider ${isConnected ? 'checked' : ''}`}>
                    <span className={`toggle-knob ${isConnected ? 'checked' : ''}`}></span>
                  </span>
                </label>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );

  // Main Content Component
  const MainContent = () => {
    if (showAddForm) {
      return (
        <div className="main-content">
          <h2 className="content-title">Add New Account</h2>
          <form onSubmit={handleAddAccount} className="form-container">
            <div className="form-group">
              <label className="form-label">Account ID</label>
              <input
                className="form-input"
                type="text"
                name="id"
                value={localForm.id}
                onChange={handleLocalChange}
                placeholder="my-account"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">JID (Jabber ID)</label>
              <input
                className="form-input"
                type="text"
                name="jid"
                value={localForm.jid}
                onChange={handleLocalChange}
                placeholder="user@domain.com"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                className="form-input"
                type="password"
                name="password"
                value={localForm.password}
                onChange={handleLocalChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Host</label>
              <input
                className="form-input"
                type="text"
                name="host"
                value={localForm.host}
                onChange={handleLocalChange}
                placeholder="localhost"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Port</label>
              <input
                className="form-input"
                type="text"
                name="port"
                value={localForm.port}
                onChange={handleLocalChange}
                placeholder="5222"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Connection Method</label>
              <select
                className="form-input"
                name="connectionMethod"
                value={localForm.connectionMethod}
                onChange={handleLocalChange}
              >
                <option value="auto">Auto</option>
                <option value="starttls">STARTTLS</option>
                <option value="directtls">Direct TLS</option>
                <option value="plain">Plain (No Encryption)</option>
              </select>
            </div>

            <button type="submit" className="form-submit-btn">Add Account</button>
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
          setResponses([]);
          toast.success('Account deleted');
        } else {
          toast.error(result?.error || 'Failed to remove account');
        }
      };

      return (
        <div className="main-content">
          <div className="content-header">
            <h2 className="content-title">Send XML Stanza</h2>
            <button
              onClick={handleDeleteAccount}
              className="delete-account-btn"
            >
              <FiTrash2 style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
              Delete Account
            </button>
          </div>

          <form onSubmit={handleSendMessage} className="form-container">
            <div className="form-group">
              <label className="form-label">XML Stanza</label>
              <textarea
                className="form-input form-textarea"
                value={message}
                onChange={handleMessageChange}
                placeholder="Paste XML stanza here"
                rows={6}
                required
              />
            </div>
            <button type="submit" className="form-submit-btn">Send Stanza</button>
            {sendStatus && (
              <div className={`form-status ${sendStatus.startsWith('Error') ? 'error' : 'success'}`}>
                {sendStatus}
              </div>
            )}
          </form>

          <div className="responses-section">
            <div className="responses-header">
              <h3 className="section-title">Stanza Responses</h3>
              <button
                onClick={() => { setResponses(responses.filter(r => r.accountId !== selectedAccount)); setSelectedResponse(null); }}
                className="clear-btn"
              >
                Clear Responses
              </button>
            </div>

            <ul className="responses-list">
              {responses.filter(r => r.accountId === selectedAccount).map((resp, idx) => (
                <li
                  key={idx}
                  className={`response-item ${selectedResponse === idx ? 'selected' : ''}`}
                  onClick={() => setSelectedResponse(idx)}
                >
                  <span>{resp.stanza.slice(0, 60)}{resp.stanza.length > 60 ? '...' : ''}</span>
                </li>
              ))}
              {responses.filter(r => r.accountId === selectedAccount).length === 0 && (
                <li className="empty-state-text" style={{ padding: '1rem', textAlign: 'center' }}>
                  No responses yet.
                </li>
              )}
            </ul>

            {selectedResponse !== null && responses.filter(r => r.accountId === selectedAccount)[selectedResponse] && (
              <div className="response-detail">
                <pre className="response-code">
                  {responses.filter(r => r.accountId === selectedAccount)[selectedResponse]?.stanza ?? ''}
                </pre>
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="main-content">
        <div className="empty-state">
          <div className="empty-state-icon">📬</div>
          <p className="empty-state-text">
            Select an account from the sidebar to send stanzas<br />
            or click "Add Account" to create a new one
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="app-container">
      <Sidebar />
      <MainContent />
    </div>
  );
};

export default App;
