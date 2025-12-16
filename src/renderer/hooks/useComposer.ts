import { useReducer, useCallback } from 'react';
import type { Performance, Stanza, AccountReference } from '../../types/performance';

interface ComposerState {
  isComposing: boolean;
  stanzas: Stanza[];
  accounts: Map<string, AccountReference>;
  startTime: number | null;
}

type ComposerAction =
  | { type: 'START' }
  | { type: 'CANCEL' }
  | { type: 'ADD_STANZA'; stanza: Stanza; account?: AccountReference }
  | { type: 'RESET' };

export const initialComposerState: ComposerState = {
  isComposing: false,
  stanzas: [],
  accounts: new Map(),
  startTime: null,
};

function cloneAccounts(accounts: Map<string, AccountReference>): Map<string, AccountReference> {
  return new Map(accounts);
}

export function generateStanzaId(): string {
  return `stanza_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export function generatePerformanceId(): string {
  return `perf_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export function composerReducer(state: ComposerState, action: ComposerAction): ComposerState {
  switch (action.type) {
    case 'START':
      return {
        isComposing: true,
        stanzas: [],
        accounts: new Map(),
        startTime: Date.now(),
      };
    case 'CANCEL':
      return {
        isComposing: false,
        stanzas: [],
        accounts: new Map(),
        startTime: null,
      };
    case 'ADD_STANZA': {
      if (!state.isComposing) return state;
      const nextAccounts = cloneAccounts(state.accounts);
      if (action.account) {
        nextAccounts.set(action.account.alias, action.account);
      }
      return {
        ...state,
        stanzas: [...state.stanzas, action.stanza],
        accounts: nextAccounts,
      };
    }
    case 'RESET':
      return initialComposerState;
    default:
      return state;
  }
}

function buildAccount(alias: string, jid?: string): AccountReference {
  return { alias, jid: jid || alias };
}

export function buildPerformanceFromState(state: ComposerState): Performance | null {
  if (!state.isComposing || state.stanzas.length === 0) {
    return null;
  }

  const now = new Date().toISOString();
  return {
    id: generatePerformanceId(),
    name: 'New Performance',
    description: '',
    version: '1.0.0',
    created: now,
    updated: now,
    accounts: Array.from(state.accounts.values()),
    stanzas: state.stanzas,
    variables: {},
    tags: [],
  };
}

export function useComposer() {
  const [state, dispatch] = useReducer(composerReducer, initialComposerState);

  const startComposing = useCallback(() => {
    dispatch({ type: 'START' });
  }, []);

  const cancelComposing = useCallback(() => {
    dispatch({ type: 'CANCEL' });
  }, []);

  const captureConnect = useCallback((accountAlias: string, jid: string) => {
    const stanza: Stanza = {
      id: generateStanzaId(),
      type: 'connect',
      accountAlias,
      description: `Connect as ${accountAlias}`,
      data: { type: 'connect' },
    };
    dispatch({ type: 'ADD_STANZA', stanza, account: buildAccount(accountAlias, jid) });
  }, []);

  const captureDisconnect = useCallback((accountAlias: string) => {
    const stanza: Stanza = {
      id: generateStanzaId(),
      type: 'disconnect',
      accountAlias,
      description: `Disconnect ${accountAlias}`,
      data: { type: 'disconnect' },
    };
    dispatch({ type: 'ADD_STANZA', stanza, account: buildAccount(accountAlias) });
  }, []);

  const captureSend = useCallback((accountAlias: string, xml: string, generatedIds?: Record<string, string>) => {
    const data = generatedIds
      ? { type: 'send' as const, xml, generatedIds }
      : { type: 'send' as const, xml };

    const stanza: Stanza = {
      id: generateStanzaId(),
      type: 'send',
      accountAlias,
      description: `${accountAlias} sends stanza`,
      data,
    };
    dispatch({ type: 'ADD_STANZA', stanza, account: buildAccount(accountAlias) });
  }, []);

  const addCue = useCallback((accountAlias: string, matchType: 'contains' | 'xpath' | 'regex' | 'id', matchExpression: string, timeout = 10000) => {
    const stanza: Stanza = {
      id: generateStanzaId(),
      type: 'cue',
      accountAlias,
      description: `Wait for response (${matchType})`,
      data: {
        type: 'cue',
        description: `Wait for ${matchType} match`,
        matchType,
        matchExpression,
        timeout,
      },
    };
    dispatch({ type: 'ADD_STANZA', stanza, account: buildAccount(accountAlias) });
  }, []);

  const addAssertion = useCallback((accountAlias: string, assertionType: 'xpath' | 'contains' | 'regex' | 'equals', expression: string, expected?: string) => {
    const data =
      expected !== undefined
        ? { type: 'assert' as const, assertionType, expression, expected }
        : { type: 'assert' as const, assertionType, expression };

    const stanza: Stanza = {
      id: generateStanzaId(),
      type: 'assert',
      accountAlias,
      description: `Assert ${assertionType}: ${expression}`,
      data,
    };
    dispatch({ type: 'ADD_STANZA', stanza, account: buildAccount(accountAlias) });
  }, []);

  const stopComposing = useCallback((): Performance | null => {
    const performance = buildPerformanceFromState(state);
    dispatch({ type: 'RESET' });
    return performance;
  }, [state]);

  return {
    isComposing: state.isComposing,
    stanzas: state.stanzas,
    startComposing,
    stopComposing,
    cancelComposing,
    captureConnect,
    captureDisconnect,
    captureSend,
    addCue,
    addAssertion,
  };
}

export type { ComposerState };
