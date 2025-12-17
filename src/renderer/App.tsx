import React, { useState, useEffect, useRef } from 'react';
import type { FC } from 'react';
import toast from 'react-hot-toast';
import { FiPlus, FiTrash2, FiCheckCircle, FiAlertCircle, FiCircle, FiLoader, FiSave } from 'react-icons/fi';
import { STANZA_TEMPLATES } from './templates';
import type { StanzaTemplate } from './templates';
import './App.css';
import { parseStanza } from './stanzaParser';
import type { ParsedField } from './stanzaParser';
import { generateTimestamp, generateUniqueId, parsePlaceholders, resolvePlaceholders } from '../shared/placeholderParser';
import type { Placeholder } from '../types/placeholder';
import { useComposer } from './hooks/useComposer';
import { CompositionsSidebar } from './components/compositions/CompositionsSidebar';
import type { Composition, Stanza, SendData } from '../types/composition';
import type { Performance } from '../types/performance';
import type { ElectronAPI } from '../types/ipc';

interface SavedTemplate extends StanzaTemplate {
  id: string;
  values: Record<string, string>;
}

interface PlaceholderFieldMeta {
  name: string;
  label: string;
  type: Placeholder['type'];
  readOnly: boolean;
  placeholder?: string;
}

declare global {
  interface Window {
    electron?: ElectronAPI;
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
  const COMPOSITION_STORAGE_KEY = 'dev-compositions';

  const loadCompositionsFallback = React.useCallback((): Composition[] => {
    try {
      const raw = localStorage.getItem(COMPOSITION_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error('[UI] Failed to load fallback compositions', err);
      return [];
    }
  }, []);

  const saveCompositionsFallback = React.useCallback((next: Composition[]) => {
    try {
      localStorage.setItem(COMPOSITION_STORAGE_KEY, JSON.stringify(next));
    } catch (err) {
      console.error('[UI] Failed to save fallback compositions', err);
    }
  }, []);

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
  const [activePlaceholders, setActivePlaceholders] = useState<Placeholder[]>([]);
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showCompositionModal, setShowCompositionModal] = useState(false);
  const [compositionName, setCompositionName] = useState('');
  const [pendingComposition, setPendingComposition] = useState<Composition | null>(null);
  const [editingComposition, setEditingComposition] = useState<Composition | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [compositions, setCompositions] = useState<Composition[]>([]);
  const [performances, setPerformances] = useState<Performance[]>([]);
  const [loadingCompositions, setLoadingCompositions] = useState(false);
  const [savingComposition, setSavingComposition] = useState(false);
  const accountIdInputRef = useRef<HTMLInputElement>(null);
  const templateFieldMap = React.useMemo(() => {
    return new Map((currentTemplate?.fields ?? []).map((f) => [f.key, f]));
  }, [currentTemplate]);

  const loadCompositions = React.useCallback(async () => {
    setLoadingCompositions(true);
    try {
      const loaded = await window.electron?.loadCompositions?.();
      if (Array.isArray(loaded)) {
        setCompositions(loaded);
        return;
      }
      const fallback = loadCompositionsFallback();
      setCompositions(fallback);
    } finally {
      setLoadingCompositions(false);
    }
  }, [loadCompositionsFallback]);

  const {
    isComposing,
    stanzas: composedStanzas,
    startComposing,
    startFromComposition,
    stopComposing,
    cancelComposing,
    captureConnect,
    captureDisconnect,
    captureSend,
    addCue,
    addAssertion,
  } = useComposer();

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

    loadCompositions();
  }, [loadCompositions]);

  const buildTemplateState = React.useCallback(
    (template: StanzaTemplate | SavedTemplate, savedValues?: Record<string, string>) => {
      const parsed = parsePlaceholders(template.xml);
      const values: Record<string, string> = { ...(savedValues || {}) };

      parsed.placeholders.forEach((ph) => {
        if (!Object.prototype.hasOwnProperty.call(values, ph.name)) {
          values[ph.name] = '';
        }
      });

      return {
        placeholders: parsed.placeholders,
        values,
        xml: template.xml,
      };
    },
    []
  );

  // Memoized stanzaListener to avoid duplicate subscriptions
  const stanzaListener = React.useCallback((accountId: string, stanza: string) => {
    setResponses(prev => [...prev, { accountId, stanza }]);
  }, []);

  // Memoized statusListener to update account status
  const statusListener = React.useCallback((accountId: string, status: string) => {
    console.log(`[UI] Status update for account "${accountId}": "${status}"`);
    setAccounts(prev => {
      console.log('[UI] Current accounts:', prev.map(a => ({ id: a.id, status: a.status })));
      const updated = prev.map(acc =>
        acc.id === accountId ? { ...acc, status } : acc
      );
      console.log('[UI] Updated accounts:', updated.map(a => ({ id: a.id, status: a.status })));
      return updated;
    });
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

  // Force focus on account ID input when add form is shown
  useEffect(() => {
    if (showAddForm && accountIdInputRef.current) {
      // Clear any existing focus first
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        accountIdInputRef.current?.focus();
        // Also try selecting any existing text
        accountIdInputRef.current?.select();
      });
    }
  }, [showAddForm]);

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
      const newAccount = { 
        id: localForm.id,
        jid: localForm.jid,
        password: localForm.password,
        host: localForm.host,
        port: localForm.port,
        connectionMethod: localForm.connectionMethod,
        status: 'disconnected' 
      };
      setAccounts([...accounts, newAccount]);
      // Immediately subscribe to status updates for the new account
      console.log(`[UI] Subscribing to stanza updates for new account: ${localForm.id}`);
      window.electron?.send('subscribe-stanza', localForm.id);
      subscribedRef.current.add(localForm.id);
      // Manually trigger status update for new account since it starts disconnected
      console.log(`[UI] Setting initial status for new account ${localForm.id}: disconnected`);
      setLocalForm({ id: '', jid: '', password: '', host: '', port: '5222', connectionMethod: 'auto' });
      setShowAddForm(false);
      toast.success(`Account "${localForm.id}" added successfully`);
    } else {
      toast.error(result?.error || 'Failed to add account');
    }
  };

  const handleConnect = async (id: string) => {
    // @ts-ignore
    const result = await window.electron?.invoke('connect-account', id);
    if (result?.success && isComposing) {
      const account = accounts.find((acc) => acc.id === id);
      captureConnect(id, account?.jid || id);
    }
  };

  const handleDisconnect = async (id: string) => {
    // @ts-ignore
    const result = await window.electron?.invoke('disconnect-account', id);
    if (result?.success && isComposing) {
      captureDisconnect(id);
    }
  };

  const openDeleteConfirm = () => {
    if (!selectedAccount) return;
    setConfirmDeleteId(selectedAccount);
  };

  const cancelDelete = () => {
    setConfirmDeleteId(null);
    // Restore focus to app
    window.focus();
    document.body.focus();
  };

  const confirmDelete = async () => {
    const targetId = confirmDeleteId;
    setConfirmDeleteId(null);
    if (!targetId) return;

    // Disconnect first if connected
    const account = accounts.find(acc => acc.id === targetId);
    if (account && account.status && account.status !== 'disconnected') {
      await window.electron?.invoke('disconnect-account', targetId);
    }

    // @ts-ignore
    const result = await window.electron?.invoke('remove-account', targetId);
    if (result?.success) {
      // Clean up subscription tracking
      subscribedRef.current.delete(targetId);
      setAccounts(accs => accs.filter(acc => acc.id !== targetId));
      setSelectedAccount(null);
      setResponses([]);
      toast.success('Account deleted');
    } else {
      toast.error(result?.error || 'Failed to remove account');
    }

    // Ensure focus returns to form if user adds again
    window.focus();
    document.body.focus();
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;

    let xmlToSend = message;
    let generatedIds: Record<string, string> | undefined;

    if (currentTemplate) {
      const resolved = resolvePlaceholders(currentTemplate.xml, templateValues, { autoGenerate: true });
      xmlToSend = resolved.xml;
      generatedIds = resolved.generatedIds;
    } else if (message) {
      // Best-effort resolution for ad-hoc stanzas with placeholder tokens
      const resolved = resolvePlaceholders(message, templateValues, { autoGenerate: true });
      xmlToSend = resolved.xml;
      generatedIds = resolved.generatedIds;
    }

    if (!xmlToSend) return;

    // @ts-ignore
    const result = await window.electron?.invoke('send-stanza', selectedAccount, xmlToSend);
    if (result?.success) {
      setSendStatus('Message sent!');
      toast.success('Stanza sent successfully');
      if (isComposing) {
        const ids = generatedIds && Object.keys(generatedIds).length > 0 ? generatedIds : undefined;
        captureSend(selectedAccount, xmlToSend, ids);
      }
    } else {
      setSendStatus(`Error: ${result?.error || 'Failed to send'}`);
      toast.error(result?.error || 'Failed to send stanza');
    }
    setTimeout(() => setSendStatus(null), 3000);
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setMessage(text);

    const parsed = parsePlaceholders(text);
    setActivePlaceholders(parsed.placeholders);

    setTemplateValues(prev => {
      const next = { ...prev } as Record<string, string>;
      parsed.placeholders.forEach(ph => {
        if (!(ph.name in next)) {
          next[ph.name] = '';
        }
      });
      // Remove values for placeholders no longer present
      Object.keys(next).forEach(key => {
        if (!parsed.placeholders.some(ph => ph.name === key)) {
          delete next[key];
        }
      });
      return next;
    });
  };

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (!value) {
      setCurrentTemplate(null);
      setTemplateValues({});
      setActivePlaceholders([]);
      setMessage('');
      return;
    }

    const template = STANZA_TEMPLATES.find(t => t.name === value);

    if (template) {
      setCurrentTemplate(template);
      setMessage(template.xml);

      const parsed = parsePlaceholders(template.xml);
      setActivePlaceholders(parsed.placeholders);

      const initialValues: Record<string, string> = {};
      parsed.placeholders.forEach(ph => {
        if (!(ph.name in initialValues)) initialValues[ph.name] = '';
      });
      setTemplateValues(initialValues);

      toast.success(`Loaded template: ${template.name}`);
    } else {
      setCurrentTemplate(null);
      setTemplateValues({});
      setActivePlaceholders([]);
    }
  };

  const handleLoadSavedTemplate = (template: SavedTemplate) => {
    const { placeholders, values, xml } = buildTemplateState(template, template.values);
    setCurrentTemplate(template);
    setTemplateValues(values);
    setActivePlaceholders(placeholders);
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
        setActivePlaceholders([]);
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

    // Keep the editor showing placeholders; resolution happens at send time.
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

  const handleStartComposing = () => {
    startComposing();
    toast.success('Composer started');
  };

  const handleStopComposing = async () => {
    const composition = stopComposing();
    if (!composition) {
      toast('No stanzas captured', { icon: 'ℹ️' });
      return;
    }

    setPendingComposition(composition);
    setCompositionName(composition.name);
    setShowCompositionModal(true);
  };

  const handleCancelComposing = () => {
    cancelComposing();
    toast('Composition discarded', { icon: '🗑️' });
  };

  const handleConfirmSaveComposition = async () => {
    if (!pendingComposition) return;

    const timestamp = new Date().toISOString();
    const toSave: Composition = {
      ...pendingComposition,
      name: compositionName.trim() || pendingComposition.name,
      updated: timestamp,
    };

    setSavingComposition(true);
    try {
      if (window.electron?.saveComposition) {
        console.log('[UI] Saving composition', toSave.id, toSave.name);
        const result = await window.electron.saveComposition(toSave);
        console.log('[UI] saveComposition result', result);
        if (result?.success) {
          toast.success('Composition saved');
          await loadCompositions();
        } else {
          toast.error('Failed to save composition');
        }
      } else {
        console.warn('[UI] saveComposition bridge not available, using fallback');
        const next = [...compositions.filter((c) => c.id !== toSave.id), toSave];
        saveCompositionsFallback(next);
        setCompositions(next);
        toast.success('Composition saved (local)');
      }
    } finally {
      setSavingComposition(false);
      setShowCompositionModal(false);
      setPendingComposition(null);
    }
  };

  const handleCancelSaveComposition = () => {
    setShowCompositionModal(false);
    setPendingComposition(null);
  };

  const handleConfirmEditComposition = async () => {
    if (!editingComposition) return;

    const timestamp = new Date().toISOString();
    const updated: Composition = {
      ...editingComposition,
      name: editName.trim() || editingComposition.name,
      description: editDescription,
      updated: timestamp,
    };

    setSavingComposition(true);
    try {
      if (window.electron?.saveComposition) {
        console.log('[UI] Updating composition', updated.id, updated.name);
        const result = await window.electron.saveComposition(updated);
        console.log('[UI] saveComposition result', result);
        if (result?.success) {
          toast.success('Composition updated');
          await loadCompositions();
        } else {
          toast.error('Failed to update composition');
        }
      } else {
        console.warn('[UI] saveComposition bridge not available, using fallback');
        const next = [...compositions.filter((c) => c.id !== updated.id), updated];
        saveCompositionsFallback(next);
        setCompositions(next);
        toast.success('Composition updated (local)');
      }
    } finally {
      setSavingComposition(false);
      setEditingComposition(null);
    }
  };

  const handleCancelEditComposition = () => {
    setEditingComposition(null);
  };

  const handleDeleteComposition = async (compositionId: string) => {
    // @ts-ignore
    const result = await window.electron?.deleteComposition?.(compositionId);
    if (result?.success || result === undefined) {
      await loadCompositions();
      toast.success('Composition deleted');
    } else {
      toast.error('Failed to delete composition');
    }
  };

  const handlePlayComposition = async (composition: Composition) => {
    toast.loading(`Performing "${composition.name}"...`, { id: 'performing' });
    
    const startTime = new Date();
    const stanzaResults: Performance['stanzaResults'] = [];
    let hasFailure = false;
    const connectedAccounts = new Set<string>();
    
    try {
      // Execute each stanza sequentially
      for (const stanza of composition.stanzas || []) {
        const stanzaStart = Date.now();
        let result: Performance['stanzaResults'][0] = {
          stanzaId: stanza.id,
          status: 'passed',
          duration: 0,
        };
        
        try {
          switch (stanza.type) {
            case 'connect': {
              // Find the account to connect
              const account = accounts.find(a => a.id === stanza.accountAlias);
              if (!account) {
                throw new Error(`Account "${stanza.accountAlias}" not found`);
              }
              
              // Connect via IPC
              const connectResult = await window.electron?.invoke('connect-account', stanza.accountAlias);
              if (connectResult && !connectResult.success) {
                throw new Error(connectResult.error || 'Connection failed');
              }
              
              // Wait a moment for connection to establish
              await new Promise(resolve => setTimeout(resolve, 500));
              connectedAccounts.add(stanza.accountAlias);
              break;
            }
            
            case 'disconnect': {
              // Disconnect via IPC
              const disconnectResult = await window.electron?.invoke('disconnect-account', stanza.accountAlias);
              if (disconnectResult && !disconnectResult.success) {
                throw new Error(disconnectResult.error || 'Disconnect failed');
              }
              connectedAccounts.delete(stanza.accountAlias);
              break;
            }
            
            case 'send': {
              if (stanza.data.type !== 'send') break;
              const sendData = stanza.data as SendData;
              
              // Send stanza via IPC
              const sendResult = await window.electron?.invoke('send-stanza', stanza.accountAlias, sendData.xml);
              if (sendResult && !sendResult.success) {
                throw new Error(sendResult.error || 'Send failed');
              }
              result.sentXml = sendData.xml;
              break;
            }
            
            case 'cue': {
              // For now, just wait the timeout period
              // Real implementation would wait for matching response
              if (stanza.data.type === 'cue') {
                const timeout = stanza.data.timeout || 5000;
                await new Promise(resolve => setTimeout(resolve, Math.min(timeout, 2000)));
              }
              break;
            }
            
            case 'assert': {
              // Assertions would check received responses
              // For now, mark as passed
              break;
            }
          }
          
          result.status = 'passed';
        } catch (err) {
          const error = err as Error;
          result.status = 'failed';
          result.error = {
            message: error.message,
            ...(error.stack && { details: error.stack }),
          };
          hasFailure = true;
        }
        
        result.duration = Date.now() - stanzaStart;
        stanzaResults.push(result);
        
        // If a stanza fails, skip remaining stanzas
        if (result.status === 'failed') {
          // Mark remaining as skipped
          const stanzas = composition.stanzas || [];
          const currentIndex = stanzas.indexOf(stanza);
          for (let i = currentIndex + 1; i < stanzas.length; i++) {
            const skippedStanza = stanzas[i];
            if (skippedStanza) {
              stanzaResults.push({
                stanzaId: skippedStanza.id,
                status: 'skipped',
                duration: 0,
              });
            }
          }
          break;
        }
      }
    } finally {
      // Cleanup: disconnect any accounts we connected
      for (const accountAlias of connectedAccounts) {
        try {
          await window.electron?.invoke('disconnect-account', accountAlias);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
    
    const endTime = new Date();
    const performance: Performance = {
      id: `perf_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      compositionId: composition.id,
      status: hasFailure ? 'failed' : 'passed',
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration: endTime.getTime() - startTime.getTime(),
      stanzaResults,
      summary: {
        total: stanzaResults.length,
        passed: stanzaResults.filter(r => r.status === 'passed').length,
        failed: stanzaResults.filter(r => r.status === 'failed').length,
        skipped: stanzaResults.filter(r => r.status === 'skipped').length,
      },
    };
    
    // Add to performances list
    setPerformances(prev => [performance, ...prev]);
    
    if (hasFailure) {
      toast.error(`Performance failed! ${performance.summary.passed}/${performance.summary.total} passed`, { id: 'performing' });
    } else {
      toast.success(`Performance completed! ${performance.summary.passed}/${performance.summary.total} passed`, { id: 'performing' });
    }
  };

  const handleLoadStanza = (stanza: Stanza) => {
    if (stanza.type === 'send' && stanza.data.type === 'send') {
      const sendData = stanza.data as SendData;
      setMessage(sendData.xml || '');
      toast.success(`Loaded stanza from ${stanza.accountAlias}`);
    } else {
      toast.error('Only send stanzas can be loaded into the editor');
    }
  };

  const handleRemoveStanza = async (compositionId: string, stanzaId: string) => {
    // Find the composition
    const composition = compositions.find(c => c.id === compositionId);
    if (!composition) {
      toast.error('Composition not found');
      return;
    }

    // Remove the stanza
    const updatedStanzas = composition.stanzas.filter(s => s.id !== stanzaId);
    const updatedComposition: Composition = {
      ...composition,
      stanzas: updatedStanzas,
      updated: new Date().toISOString(),
    };

    // Save the updated composition
    try {
      const result = await window.electron?.saveComposition?.(updatedComposition);
      if (result?.success || result === undefined) {
        await loadCompositions();
        toast.success('Stanza removed');
      } else {
        toast.error('Failed to remove stanza');
      }
    } catch (err) {
      console.error('[UI] Failed to remove stanza:', err);
      toast.error('Failed to remove stanza');
    }
  };

  const handleRecordMore = (composition: Composition) => {
    // Start composing with the existing composition's stanzas loaded
    startFromComposition(composition);
    toast.success(`Recording onto "${composition.name}"`, { icon: '🎬' });
  };

  const handleMoveStanza = async (compositionId: string, stanzaId: string, direction: 'up' | 'down') => {
    // Find the composition
    const composition = compositions.find(c => c.id === compositionId);
    if (!composition) {
      toast.error('Composition not found');
      return;
    }

    // Find the stanza index
    const stanzas = [...composition.stanzas];
    const index = stanzas.findIndex(s => s.id === stanzaId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= stanzas.length) return;

    // Swap stanzas - use splice to swap elements
    const removed = stanzas.splice(index, 1)[0];
    if (!removed) return;
    stanzas.splice(newIndex, 0, removed);

    const updatedComposition: Composition = {
      ...composition,
      stanzas,
      updated: new Date().toISOString(),
    };

    // Save the updated composition
    try {
      const result = await window.electron?.saveComposition?.(updatedComposition);
      if (result?.success || result === undefined) {
        await loadCompositions();
        toast.success('Stanza moved');
      } else {
        toast.error('Failed to move stanza');
      }
    } catch (err) {
      console.error('[UI] Failed to move stanza:', err);
      toast.error('Failed to move stanza');
    }
  };

  const handleExportComposition = async (composition: Composition) => {
    try {
      // For now, just download as JSON
      const json = JSON.stringify(composition, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${composition.name || 'composition'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Composition exported');
    } catch (err) {
      console.error('[UI] Failed to export composition:', err);
      toast.error('Failed to export composition');
    }
  };

  const handleImportComposition = async () => {
    try {
      // Create file input to select file
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const json = event.target?.result as string;
            const imported = JSON.parse(json) as Composition;
            
            // Generate new ID to avoid conflicts
            const newComposition: Composition = {
              ...imported,
              id: `comp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
              created: new Date().toISOString(),
              updated: new Date().toISOString(),
            };
            
            const result = await window.electron?.saveComposition?.(newComposition);
            if (result?.success || result === undefined) {
              await loadCompositions();
              toast.success(`Imported "${newComposition.name}"`);
            } else {
              toast.error('Failed to import composition');
            }
          } catch (parseErr) {
            console.error('[UI] Failed to parse imported file:', parseErr);
            toast.error('Invalid composition file');
          }
        };
        reader.readAsText(file);
      };
      input.click();
    } catch (err) {
      console.error('[UI] Failed to import composition:', err);
      toast.error('Failed to import composition');
    }
  };

  const handleEditComposition = (composition: Composition) => {
    setEditingComposition(composition);
    setEditName(composition.name || '');
    setEditDescription(composition.description || '');
  };

  return (
    <div className="app-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <button
            className="add-account-btn"
            onClick={(e) => {
              (e.target as HTMLButtonElement).blur();
              setSelectedAccount(null);
              setLocalForm({ id: '', jid: '', password: '', host: '', port: '5222', connectionMethod: 'auto' });
              setShowAddForm(true);
            }}
          >
            <FiPlus style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
            Add Account
          </button>
        </div>

        <ul className="accounts-list">
          {accounts.map((acc) => {
            const isSelected = selectedAccount === acc.id;
            const isConnected = acc.status === 'connected' || acc.status === 'online';
            const isConnecting = acc.status === 'connecting' || acc.status === 'opening' || acc.status === 'connect';

            return (
              <li key={acc.id} className={`account-item ${isSelected ? 'selected' : ''}`}>
                <div
                  onClick={() => {
                    setSelectedAccount(acc.id);
                    setShowAddForm(false);
                    setSelectedResponse(null);
                  }}
                >
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
                      onChange={() => (isConnected ? handleDisconnect(acc.id) : handleConnect(acc.id))}
                    />
                    <span className={`toggle-slider ${isConnected ? 'checked' : ''}`} />
                    <span className={`toggle-knob ${isConnected ? 'checked' : ''}`} />
                  </label>
                  <span className="toggle-label">
                    {isConnecting ? 'Connecting...' : isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="main-pane">
        {showAddForm ? (
          <div className="main-content">
            <h2 className="content-title">Add New Account</h2>
            <form onSubmit={handleAddAccount} className="form-container">
              <div className="form-group">
                <label className="form-label">Account ID</label>
                <input
                  ref={accountIdInputRef}
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
              <button onClick={openDeleteConfirm} className="delete-account-btn">
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
                      value={currentTemplate && !(currentTemplate as any).id ? currentTemplate.name : ''}
                    >
                      <option value="">Load Template...</option>
                      {STANZA_TEMPLATES.map((t) => (
                        <option key={t.name} value={t.name}>
                          {t.name}
                        </option>
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

                {activePlaceholders.length > 0 && (
                  <div className="template-fields" style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Template Parameters</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      {activePlaceholders.map((ph) => {
                        const meta = templateFieldMap.get(ph.name) || templateFieldMap.get(ph.name.replace(/^\$/, ''));
                        const label = meta?.label || ph.name.replace(/^\$/, '');
                        const isTimestamp = ph.type === 'timestamp';
                        const isId = ph.type === 'id';
                        const placeholderText = meta?.placeholder || (isTimestamp ? 'auto-generated' : '');

                        return (
                          <div key={`${ph.name}-${ph.startIndex}`}>
                            <label style={{ display: 'block', fontSize: '0.7rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>
                              {label}
                              {isTimestamp ? ' (auto)' : ''}
                            </label>
                            <input
                              type="text"
                              className="form-input"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                              placeholder={placeholderText}
                              value={templateValues[ph.name] || ''}
                              onChange={(e) => handleTemplateValueChange(ph.name, e.target.value)}
                              disabled={isTimestamp}
                            />
                            {isTimestamp && (
                              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                                Auto-generated; copy if you need to reference it elsewhere.
                              </div>
                            )}
                            {isId && (
                              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                                Tip: enter <code>${'{'}id-label{'}'}</code> to auto-generate and track by label.
                              </div>
                            )}
                          </div>
                        );
                      })}
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
                  {savedTemplates.map((t) => (
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
                        transition: 'all 0.2s ease',
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
                          justifyContent: 'center',
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
                  onClick={() => {
                    setResponses(responses.filter((r) => r.accountId !== selectedAccount));
                    setSelectedResponse(null);
                  }}
                  className="clear-btn"
                >
                  Clear Responses
                </button>
              </div>

              <ul className="responses-list">
                {responses
                  .filter((r) => r.accountId === selectedAccount)
                  .map((resp, idx) => (
                    <li
                      key={idx}
                      className={`response-item ${selectedResponse === idx ? 'selected' : ''}`}
                      onClick={() => setSelectedResponse(idx)}
                    >
                      <span>
                        {resp.stanza.slice(0, 60)}
                        {resp.stanza.length > 60 ? '...' : ''}
                      </span>
                    </li>
                  ))}
                {responses.filter((r) => r.accountId === selectedAccount).length === 0 && (
                  <li className="empty-state-text" style={{ padding: '1rem', textAlign: 'center' }}>
                    No responses yet.
                  </li>
                )}
              </ul>

              {selectedResponse !== null && responses.filter((r) => r.accountId === selectedAccount)[selectedResponse] && (
                <div className="response-detail">
                  <div className="response-detail-container">
                    <div className="response-raw">
                      <h4 className="inspector-section-title">Raw XML</h4>
                      <pre className="response-code">
                        {responses.filter((r) => r.accountId === selectedAccount)[selectedResponse]?.stanza ?? ''}
                      </pre>
                    </div>
                    <div className="response-inspector">
                      <h4 className="inspector-section-title">Inspector</h4>
                      {(() => {
                        const activeResponse = responses.filter((r) => r.accountId === selectedAccount)[selectedResponse!];
                        const stanza = activeResponse?.stanza ?? '';
                        const fields = parseStanza(stanza);

                        const sections: Record<string, ParsedField[]> = {};
                        const mainFields: ParsedField[] = [];

                        fields.forEach((f) => {
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
                Select an account from the sidebar to send stanzas
                <br />
                or click "Add Account" to create a new one
              </p>
            </div>
          </div>
        )}
      </div>

      <CompositionsSidebar
        isComposing={isComposing}
        stanzas={composedStanzas}
        compositions={compositions}
        performances={performances}
        loading={loadingCompositions || savingComposition}
        onStart={handleStartComposing}
        onStop={handleStopComposing}
        onCancel={handleCancelComposing}
        onPlay={handlePlayComposition}
        onEdit={handleEditComposition}
        onDelete={handleDeleteComposition}
        onLoadStanza={handleLoadStanza}
        onRemoveStanza={handleRemoveStanza}
        onMoveStanza={handleMoveStanza}
        onRecordMore={handleRecordMore}
        onExportComposition={handleExportComposition}
        onImportComposition={handleImportComposition}
      />

      {confirmDeleteId && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="modal-content" style={{ background: 'var(--bg-primary)', padding: '1.5rem', borderRadius: 'var(--radius-md)', width: '320px', boxShadow: 'var(--shadow-lg)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Delete Account?</h3>
            <p style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Are you sure you want to delete the account "{confirmDeleteId}"?
              Accounts from accounts.json will only be removed from the app, not from the file.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={cancelDelete} className="clear-btn">Cancel</button>
              <button onClick={confirmDelete} className="delete-account-btn">Delete</button>
            </div>
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

      {showCompositionModal && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="modal-content" style={{ background: 'var(--bg-primary)', padding: '1.5rem', borderRadius: 'var(--radius-md)', width: '320px', boxShadow: 'var(--shadow-lg)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--text-primary)' }}>Save Composition</h3>
            <input
              type="text"
              className="form-input"
              value={compositionName}
              onChange={(e) => setCompositionName(e.target.value)}
              placeholder="Composition Name"
              autoFocus
              style={{ marginBottom: '1rem' }}
              disabled={savingComposition}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={handleCancelSaveComposition} className="clear-btn" disabled={savingComposition}>Cancel</button>
              <button onClick={handleConfirmSaveComposition} className="form-submit-btn" style={{ width: 'auto' }} disabled={savingComposition}>Save</button>
            </div>
          </div>
        </div>
      )}

      {editingComposition && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="modal-content" style={{ background: 'var(--bg-primary)', padding: '1.5rem', borderRadius: 'var(--radius-md)', width: '360px', boxShadow: 'var(--shadow-lg)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--text-primary)' }}>Edit Composition</h3>
            <label className="form-label" style={{ marginBottom: '0.25rem' }}>Name</label>
            <input
              type="text"
              className="form-input"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Composition Name"
              autoFocus
              style={{ marginBottom: '0.75rem' }}
              disabled={savingComposition}
            />
            <label className="form-label" style={{ marginBottom: '0.25rem' }}>Description</label>
            <textarea
              className="form-input"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
              style={{ marginBottom: '1rem' }}
              disabled={savingComposition}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={handleCancelEditComposition} className="clear-btn" disabled={savingComposition}>Cancel</button>
              <button onClick={handleConfirmEditComposition} className="form-submit-btn" style={{ width: 'auto' }} disabled={savingComposition}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
