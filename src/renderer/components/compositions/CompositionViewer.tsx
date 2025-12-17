import React from 'react';
import type { ReactElement } from 'react';
import { FiPlay, FiPlus, FiTrash2, FiArrowLeft, FiSend, FiChevronUp, FiChevronDown } from 'react-icons/fi';
import type { Composition, Stanza, StanzaType } from '../../../types/composition';

interface CompositionViewerProps {
  composition: Composition;
  onBack: () => void;
  onLoadStanza: (stanza: Stanza) => void;
  onRemoveStanza: (stanzaId: string) => void;
  onMoveStanza?: (stanzaId: string, direction: 'up' | 'down') => void;
  onRecordMore: () => void;
  onPlay: () => void;
}

const emojiMap: Record<StanzaType, string> = {
  connect: '🔗',
  disconnect: '🔌',
  send: '📤',
  cue: '⏱️',
  assert: '✅',
};

function formatStanzaDescription(stanza: Stanza): string {
  switch (stanza.type) {
    case 'connect':
      return `${stanza.accountAlias} connects`;
    case 'disconnect':
      return `${stanza.accountAlias} disconnects`;
    case 'send':
      return `${stanza.accountAlias} sends stanza`;
    case 'cue':
      return `Wait for response`;
    case 'assert':
      return `Assert condition`;
    default:
      return stanza.description;
  }
}

export function CompositionViewer({
  composition,
  onBack,
  onLoadStanza,
  onRemoveStanza,
  onMoveStanza,
  onRecordMore,
  onPlay,
}: CompositionViewerProps): ReactElement {
  return (
    <div className="composition-viewer">
      <div className="composition-viewer-header">
        <button className="btn-icon" onClick={onBack} title="Back to list">
          <FiArrowLeft />
        </button>
        <div className="composition-viewer-title">
          <h4>{composition.name || 'Untitled Composition'}</h4>
          {composition.description && (
            <p className="composition-viewer-desc">{composition.description}</p>
          )}
        </div>
      </div>

      <div className="composition-viewer-actions">
        <button className="btn-small btn-primary" onClick={onPlay}>
          <FiPlay /> Perform
        </button>
        <button className="btn-small btn-secondary" onClick={onRecordMore}>
          <FiPlus /> Record More
        </button>
      </div>

      <div className="composition-viewer-stanzas">
        <div className="stanzas-header">
          <span>Stanzas ({composition.stanzas?.length ?? 0})</span>
        </div>
        
        {(!composition.stanzas || composition.stanzas.length === 0) ? (
          <div className="stanzas-empty">
            <p>No stanzas in this composition</p>
            <p className="hint">Click "Record More" to add actions</p>
          </div>
        ) : (
          <div className="stanzas-list">
            {composition.stanzas.map((stanza, index) => (
              <div key={stanza.id} className="stanza-row">
                <div className="stanza-reorder">
                  <button
                    className="btn-icon-tiny"
                    onClick={() => onMoveStanza?.(stanza.id, 'up')}
                    disabled={index === 0}
                    title="Move up"
                  >
                    <FiChevronUp />
                  </button>
                  <button
                    className="btn-icon-tiny"
                    onClick={() => onMoveStanza?.(stanza.id, 'down')}
                    disabled={index === composition.stanzas.length - 1}
                    title="Move down"
                  >
                    <FiChevronDown />
                  </button>
                </div>
                <span className="stanza-index">{index + 1}</span>
                <span className="stanza-emoji">{emojiMap[stanza.type] || '📋'}</span>
                <span className="stanza-description">{formatStanzaDescription(stanza)}</span>
                <div className="stanza-row-actions">
                  {stanza.type === 'send' && (
                    <button
                      className="btn-icon-small"
                      onClick={() => onLoadStanza(stanza)}
                      title="Load into editor"
                    >
                      <FiSend />
                    </button>
                  )}
                  <button
                    className="btn-icon-small danger"
                    onClick={() => onRemoveStanza(stanza.id)}
                    title="Remove stanza"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="composition-viewer-meta">
        <div className="meta-row">
          <span className="meta-label">Created:</span>
          <span className="meta-value">{new Date(composition.created).toLocaleDateString()}</span>
        </div>
        <div className="meta-row">
          <span className="meta-label">Updated:</span>
          <span className="meta-value">{new Date(composition.updated).toLocaleDateString()}</span>
        </div>
        {composition.accounts && composition.accounts.length > 0 && (
          <div className="meta-row">
            <span className="meta-label">Accounts:</span>
            <span className="meta-value">{composition.accounts.map(a => a.alias).join(', ')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
