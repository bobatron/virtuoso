import React, { useState, useEffect } from 'react';
import type { FC } from 'react';
import toast from 'react-hot-toast';
import { FiPlus, FiTrash2, FiCheckCircle, FiAlertCircle, FiCircle, FiLoader, FiSave } from 'react-icons/fi';
import { STANZA_TEMPLATES } from './templates';
import type { StanzaTemplate } from './templates';
import './App.css';
import { parseStanza } from './stanzaParser';
import type { ParsedField } from './stanzaParser';

interface SavedTemplate extends StanzaTemplate {
  id: string;
  values: Record<string, string>;
}

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
  const [currentTemplate, setCurrentTemplate] = useState<StanzaTemplate | null>(null);
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({});
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');

  useEffect(() => {
    // Load accounts and templates from backend on mount
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

    // @ts-ignore
    window.electron?.invoke('get-templates').then((templates: SavedTemplate[]) => {
      if (templates) {
        setSavedTemplates(templates);
      }
    });
  }, []);

  // Memoized stanzaListener to avoid duplicate subscriptions
  const stanzaListener = React.useCallback((accountId: string, stanza: string) => {
    setResponses(prev => [...prev, { accountId, stanza }]);
  }, []);

  // Memoized statusListener to update account status
  const statusListener = React.useCallback((accountId: string, status: string) => {
    console.log(`[UI] Status update for account "${accountId}": "${status}"`);
    console.log('[UI] Current accounts:', accounts.map(a => ({ id: a.id, status: a.status })));
    setAccounts(prev => {
      const updated = prev.map(acc =>
        acc.id === accountId ? { ...acc, status } : acc
      );
      console.log('[UI] Updated accounts:', updated.map(a => ({ id: a.id, status: a.status })));
      return updated;
    });
  }, [accounts]);

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
    const { name, value } = e.target;
    setLocalForm(prev => ({ ...prev, [name]: value }));
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
      setAccounts([...accounts, { 
        id: localForm.id,
        jid: localForm.jid,
        password: localForm.password,
        host: localForm.host,
        port: localForm.port,
        connectionMethod: localForm.connectionMethod,
        status: 'disconnected' 
      }]);
      setLocalForm({ id: '', jid: '', password: '', host: '', port: '5222', connectionMethod: 'auto' });
      setShowAddForm(false);
      toast.success(`Account "${localForm.id}" added successfully`);
    } else {
      toast.error(result?.error || 'Failed to add account');
    }
  };

  const handleConnect = async (id: string) => {
    // @ts-ignore
    await window.electron?.invoke('connect-account', id);
  };

  const handleDisconnect = async (id: string) => {
    // @ts-ignore
    await window.electron?.invoke('disconnect-account', id);
  };

  const handleDeleteAccount = async () => {
    if (!selectedAccount) return;
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

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (!value) return;

    // Check standard templates
    const template = STANZA_TEMPLATES.find(t => t.name === value);

    if (template) {
      setCurrentTemplate(template);

      // Initialize values
      const initialValues: Record<string, string> = {};
      template.fields.forEach(f => {
        initialValues[f.key] = f.defaultValue || '';
      });

      setTemplateValues(initialValues);

      // Generate initial XML
      let xml = template.xml;
      Object.entries(initialValues).forEach(([key, val]) => {
        xml = xml.replace(new RegExp(`{{${key}}}`, 'g'), val);
      });
      setMessage(xml);

      toast.success(`Loaded template: ${template.name}`);
    } else {
      setCurrentTemplate(null);
      setTemplateValues({});
    }
  };

  const handleLoadSavedTemplate = (template: SavedTemplate) => {
    setCurrentTemplate(template);
    setTemplateValues({ ...template.values });

    // Generate XML from saved values
    let xml = template.xml;
    Object.entries(template.values).forEach(([key, val]) => {
      xml = xml.replace(new RegExp(`{{${key}}}`, 'g'), val);
    });
    setMessage(xml);
    toast.success(`Loaded saved template: ${template.name}`);
  };

  const handleSaveTemplate = () => {
    if (!currentTemplate) return;
    setSaveName(currentTemplate.name);
    setShowSaveModal(true);
  };

  const confirmSaveTemplate = async () => {
    if (!currentTemplate || !saveName) return;

    const newTemplate: SavedTemplate = {
      ...currentTemplate,
      id: crypto.randomUUID(),
      name: saveName,
      values: templateValues
    };

    // @ts-ignore
    const result = await window.electron?.invoke('save-template', newTemplate);
    if (result?.success) {
      setSavedTemplates([...savedTemplates, newTemplate]);
      toast.success('Template saved successfully');
      setShowSaveModal(false);
    } else {
      toast.error('Failed to save template');
    }
  };

  const handleDeleteTemplate = async (templateId: string, templateName: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent loading the template when clicking delete
    if (!confirm(`Delete template "${templateName}"?`)) return;

    // @ts-ignore
    const result = await window.electron?.invoke('delete-template', templateId);
    if (result?.success) {
      setSavedTemplates(prev => prev.filter(t => t.id !== templateId));
      if ((currentTemplate as any)?.id === templateId) {
        setCurrentTemplate(null);
        setTemplateValues({});
        setMessage('');
      }
      toast.success('Template deleted');
    } else {
      toast.error('Failed to delete template');
    }
  };

  const handleTemplateValueChange = (key: string, value: string) => {
    const newValues = { ...templateValues, [key]: value };
    setTemplateValues(newValues);

    if (currentTemplate) {
      let xml = currentTemplate.xml;
      Object.entries(newValues).forEach(([k, v]) => {
        xml = xml.replace(new RegExp(`{{${k}}}`, 'g'), v);
      });
      setMessage(xml);
    }
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

  return (
    <div className="app-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <button
            className="add-account-btn"
            onClick={() => { 
              setShowAddForm(true); 
              setSelectedAccount(null); 
              setLocalForm({ id: '', jid: '', password: '', host: '', port: '5222', connectionMethod: 'auto' });
            }}
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

      {showAddForm ? (
        <div className="main-content" key="add-account-form">
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
      ) : selectedAccount ? (
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
              <div style={{ marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>XML Stanza</label>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select
                    className="form-input"
                    style={{ flex: 1, padding: '0.25rem 0.5rem', fontSize: '0.8rem', height: 'auto' }}
                    onChange={handleTemplateChange}
                    value={currentTemplate && !(currentTemplate as any).id ? currentTemplate.name : ""}
                  >
                    <option value="">Load Template...</option>
                    {STANZA_TEMPLATES.map(t => (
                      <option key={t.name} value={t.name}>{t.name}</option>
                    ))}
                  </select>

                  {currentTemplate && (
                    <button
                      type="button"
                      onClick={handleSaveTemplate}
                      className="form-submit-btn"
                      style={{ width: 'auto', padding: '0.25rem 0.75rem', fontSize: '0.8rem', margin: 0, background: 'var(--status-online)', display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}
                      title="Save current configuration as new template"
                    >
                      <FiSave /> Save
                    </button>
                  )}
                </div>
              </div>

              {currentTemplate && currentTemplate.fields.length > 0 && (
                <div className="template-fields" style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Template Parameters</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    {currentTemplate.fields.map(field => (
                      <div key={field.key}>
                        <label style={{ display: 'block', fontSize: '0.7rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>{field.label}</label>
                        <input
                          type="text"
                          className="form-input"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                          placeholder={field.placeholder}
                          value={templateValues[field.key] || ''}
                          onChange={(e) => handleTemplateValueChange(field.key, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

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

          {savedTemplates.length > 0 && (
            <div className="saved-templates-section" style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
              <h3 className="section-title" style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>Saved Templates</h3>
              <div className="saved-templates-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
                {savedTemplates.map(t => (
                  <div
                    key={t.id}
                    className={`saved-template-card ${currentTemplate && (currentTemplate as any).id === t.id ? 'selected' : ''}`}
                    onClick={() => handleLoadSavedTemplate(t)}
                    style={{
                      padding: '0.75rem',
                      background: 'var(--bg-secondary)',
                      borderRadius: 'var(--radius-sm)',
                      border: currentTemplate && (currentTemplate as any).id === t.id ? '1px solid var(--primary-color)' : '1px solid var(--border-light)',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.25rem' }}>{t.name}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t.description}
                    </div>
                    <button
                      onClick={(e) => handleDeleteTemplate(t.id, t.name, e)}
                      style={{
                        position: 'absolute',
                        top: '0.5rem',
                        right: '0.5rem',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        padding: '0.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Delete template"
                    >
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                <div className="response-detail-container">
                  <div className="response-raw">
                    <h4 className="inspector-section-title">Raw XML</h4>
                    <pre className="response-code">
                      {responses.filter(r => r.accountId === selectedAccount)[selectedResponse]?.stanza ?? ''}
                    </pre>
                  </div>
                  <div className="response-inspector">
                    <h4 className="inspector-section-title">Inspector</h4>
                    {(() => {
                      const activeResponse = responses.filter(r => r.accountId === selectedAccount)[selectedResponse!];
                      const stanza = activeResponse?.stanza ?? '';
                      const fields = parseStanza(stanza);

                      // Group by section
                      const sections: Record<string, ParsedField[]> = {};
                      const mainFields: ParsedField[] = [];

                      fields.forEach(f => {
                        if (f.section) {
                          if (!sections[f.section]) sections[f.section] = [];
                          sections[f.section]!.push(f);
                        } else {
                          mainFields.push(f);
                        }
                      });

                      return (
                        <div>
                          {mainFields.map((f, i) => (
                            <div key={`main-${i}`} className="inspector-field">
                              <span className="inspector-key">{f.key}:</span>
                              <span className="inspector-value">{f.value}</span>
                            </div>
                          ))}

                          {Object.entries(sections).map(([section, sFields]) => (
                            <div key={section} className="inspector-section">
                              <div className="inspector-section-title">{section}</div>
                              {sFields.map((f, i) => (
                                <div key={`${section}-${i}`} className="inspector-field">
                                  <span className="inspector-key">{f.key}:</span>
                                  <span className="inspector-value">{f.value}</span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="main-content">
          <div className="empty-state">
            <div className="empty-state-icon">📬</div>
            <p className="empty-state-text">
              Select an account from the sidebar to send stanzas<br />
              or click "Add Account" to create a new one
            </p>
          </div>
        </div>
      )}

      {showSaveModal && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="modal-content" style={{ background: 'var(--bg-primary)', padding: '1.5rem', borderRadius: 'var(--radius-md)', width: '300px', boxShadow: 'var(--shadow-lg)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--text-primary)' }}>Save Template</h3>
            <input
              type="text"
              className="form-input"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Template Name"
              autoFocus
              style={{ marginBottom: '1rem' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={() => setShowSaveModal(false)} className="clear-btn">Cancel</button>
              <button onClick={confirmSaveTemplate} className="form-submit-btn" style={{ width: 'auto' }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
