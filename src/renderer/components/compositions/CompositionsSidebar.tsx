import React, { useState } from 'react';
import type { ReactElement } from 'react';
import { FiPlus, FiPlay, FiEdit2, FiTrash2, FiCircle, FiMusic, FiRadio } from 'react-icons/fi';
import type { Composition, Stanza } from '../../../types/composition';
import type { Performance } from '../../../types/performance';
import { ComposerPanel } from './ComposerPanel';
import { CompositionList } from './CompositionList';
import { CompositionViewer } from './CompositionViewer';
import { ConductorPanel } from './ConductorPanel';
import { PerformanceViewer } from './PerformanceViewer';

type TabType = 'composer' | 'conductor';

interface CompositionsSidebarProps {
  isComposing: boolean;
  stanzas: Stanza[];
  compositions: Composition[];
  performances: Performance[];
  loading: boolean;
  onStart: () => void;
  onStop: () => void;
  onCancel: () => void;
  onPlay: (composition: Composition) => void;
  onEdit: (composition: Composition) => void;
  onDelete: (compositionId: string) => void;
  onLoadStanza?: (stanza: Stanza) => void;
  onRemoveStanza?: (compositionId: string, stanzaId: string) => void;
  onMoveStanza?: (compositionId: string, stanzaId: string, direction: 'up' | 'down') => void;
  onRecordMore?: (composition: Composition) => void;
  onExportComposition?: (composition: Composition) => void;
  onImportComposition?: () => void;
}

export function CompositionsSidebar({
  isComposing,
  stanzas,
  compositions,
  performances,
  loading,
  onStart,
  onStop,
  onCancel,
  onPlay,
  onEdit,
  onDelete,
  onLoadStanza,
  onRemoveStanza,
  onMoveStanza,
  onRecordMore,
  onExportComposition,
  onImportComposition,
}: CompositionsSidebarProps): ReactElement {
  const [activeTab, setActiveTab] = useState<TabType>('composer');
  const [viewingComposition, setViewingComposition] = useState<Composition | null>(null);
  const [viewingPerformance, setViewingPerformance] = useState<Performance | null>(null);

  const handleViewComposition = (composition: Composition) => {
    setViewingComposition(composition);
  };

  const handleBackToList = () => {
    setViewingComposition(null);
  };

  const handleViewPerformance = (performance: Performance) => {
    setViewingPerformance(performance);
  };

  const handleBackToPerformances = () => {
    setViewingPerformance(null);
  };

  const handleLoadStanza = (stanza: Stanza) => {
    onLoadStanza?.(stanza);
  };

  const handleRemoveStanza = (stanzaId: string) => {
    if (viewingComposition) {
      onRemoveStanza?.(viewingComposition.id, stanzaId);
      // Update local view with removed stanza
      setViewingComposition({
        ...viewingComposition,
        stanzas: viewingComposition.stanzas.filter(s => s.id !== stanzaId),
      });
    }
  };

  const handleRecordMore = () => {
    if (viewingComposition) {
      onRecordMore?.(viewingComposition);
    }
  };

  const handleMoveStanza = (stanzaId: string, direction: 'up' | 'down') => {
    if (viewingComposition) {
      onMoveStanza?.(viewingComposition.id, stanzaId, direction);
      // Update local view with reordered stanzas
      const stanzas = [...viewingComposition.stanzas];
      const index = stanzas.findIndex(s => s.id === stanzaId);
      if (index === -1) return;
      
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= stanzas.length) return;
      
      // Swap stanzas - use splice to swap elements
      const removed = stanzas.splice(index, 1)[0];
      if (!removed) return;
      stanzas.splice(newIndex, 0, removed);
      setViewingComposition({
        ...viewingComposition,
        stanzas,
      });
    }
  };

  const handlePlayComposition = () => {
    if (viewingComposition) {
      onPlay(viewingComposition);
    }
  };

  return (
    <aside className="compositions-sidebar">
      {/* Tab Bar */}
      <div className="sidebar-tabs">
        <button
          className={`sidebar-tab ${activeTab === 'composer' ? 'active' : ''}`}
          onClick={() => setActiveTab('composer')}
        >
          <FiMusic /> Composer
        </button>
        <button
          className={`sidebar-tab ${activeTab === 'conductor' ? 'active' : ''}`}
          onClick={() => setActiveTab('conductor')}
        >
          <FiRadio /> Conductor
        </button>
      </div>

      {activeTab === 'composer' && (
        <>
          <div className="compositions-header">
            <h3>Compositions</h3>
            {!isComposing && !viewingComposition && (
              <button className="compose-button" onClick={onStart} aria-label="Compose New">
                <FiPlus /> New
              </button>
            )}
            {isComposing && (
              <div className="recording-pill" title="Composing">
                <FiCircle className="recording-dot" /> Recording
              </div>
            )}
          </div>

          {isComposing ? (
            <ComposerPanel stanzas={stanzas} onStop={onStop} onCancel={onCancel} />
          ) : viewingComposition ? (
            <CompositionViewer
              composition={viewingComposition}
              onBack={handleBackToList}
              onLoadStanza={handleLoadStanza}
              onRemoveStanza={handleRemoveStanza}
              onMoveStanza={handleMoveStanza}
              onRecordMore={handleRecordMore}
              onPlay={handlePlayComposition}
            />
          ) : (
            <CompositionList
              compositions={compositions}
              loading={loading}
              onPlay={onPlay}
              onEdit={onEdit}
              onDelete={onDelete}
              onView={handleViewComposition}
            />
          )}

          {!isComposing && !viewingComposition && (
            <div className="composition-actions-hint">
              <div className="hint-row"><FiPlay /> Perform</div>
              <div className="hint-row"><FiEdit2 /> Edit</div>
              <div className="hint-row"><FiTrash2 /> Delete</div>
            </div>
          )}
        </>
      )}

      {activeTab === 'conductor' && (
        <>
          {viewingPerformance ? (
            <PerformanceViewer
              performance={viewingPerformance}
              compositionName={compositions.find(c => c.id === viewingPerformance.compositionId)?.name ?? 'Unknown'}
              onBack={handleBackToPerformances}
            />
          ) : (
            <ConductorPanel
              compositions={compositions}
              performances={performances}
              loading={loading}
              onPerform={onPlay}
              onExport={onExportComposition || (() => {})}
              onImport={onImportComposition || (() => {})}
              onViewPerformance={handleViewPerformance}
            />
          )}
        </>
      )}
    </aside>
  );
}
