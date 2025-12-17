import { useReducer, useCallback } from 'react';
import type { Composition, Stanza, AccountReference } from '../../types/composition';

interface ComposerState {
  isComposing: boolean;
  stanzas: Stanza[];
  accounts: Map<string, AccountReference>;
  startTime: number | null;
  targetComposition: Composition | null; // When recording onto existing composition
}

type ComposerAction =
  | { type: 'START' }
  | { type: 'START_FROM_COMPOSITION'; composition: Composition }
  | { type: 'CANCEL' }
  | { type: 'ADD_STANZA'; stanza: Stanza; account?: AccountReference }
  | { type: 'RESET' };

export const initialComposerState: ComposerState = {
  isComposing: false,
  stanzas: [],
  accounts: new Map(),
  startTime: null,
  targetComposition: null,
};

function cloneAccounts(accounts: Map<string, AccountReference>): Map<string, AccountReference> {
  return new Map(accounts);
}

export function generateStanzaId(): string {
  return `stanza_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export function generateCompositionId(): string {
  return `comp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export function composerReducer(state: ComposerState, action: ComposerAction): ComposerState {
  switch (action.type) {
    case 'START':
      return {
        isComposing: true,
        stanzas: [],
        accounts: new Map(),
        startTime: Date.now(),
        targetComposition: null,
      };
    case 'START_FROM_COMPOSITION': {
      // Start composing with existing composition's stanzas and accounts
      const existingAccounts = new Map<string, AccountReference>();
      for (const acc of action.composition.accounts || []) {
        existingAccounts.set(acc.alias, acc);
      }
      return {
        isComposing: true,
        stanzas: [...(action.composition.stanzas || [])],
        accounts: existingAccounts,
        startTime: Date.now(),
        targetComposition: action.composition,
      };
    }
    case 'CANCEL':
      return {
        isComposing: false,
        stanzas: [],
        accounts: new Map(),
        startTime: null,
        targetComposition: null,
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

export function buildCompositionFromState(state: ComposerState): Composition | null {
  if (!state.isComposing || state.stanzas.length === 0) {
    return null;
  }

  const now = new Date().toISOString();
  
  // If we're recording onto an existing composition, preserve its metadata
  if (state.targetComposition) {
    return {
      ...state.targetComposition,
      updated: now,
      accounts: Array.from(state.accounts.values()),
      stanzas: state.stanzas,
    };
  }

  // New composition
  return {
    id: generateCompositionId(),
    name: 'New Composition',
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

  const startFromComposition = useCallback((composition: Composition) => {
    dispatch({ type: 'START_FROM_COMPOSITION', composition });
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

  const stopComposing = useCallback((): Composition | null => {
    const composition = buildCompositionFromState(state);
    dispatch({ type: 'RESET' });
    return composition;
  }, [state]);

  return {
    isComposing: state.isComposing,
    stanzas: state.stanzas,
    targetComposition: state.targetComposition,
    startComposing,
    startFromComposition,
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
