import React, { useState } from 'react';
import type { ReactElement } from 'react';
import { FiPlay, FiDownload, FiCheckCircle, FiXCircle, FiClock, FiList } from 'react-icons/fi';
import type { Composition } from '../../../types/composition';
import type { Performance } from '../../../types/performance';

interface ConductorPanelProps {
  compositions: Composition[];
  performances: Performance[];
  loading: boolean;
  onPerform: (composition: Composition) => void;
  onExport: (composition: Composition) => void;
  onViewPerformance: (performance: Performance) => void;
}

type ViewMode = 'compositions' | 'performances';

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

export function ConductorPanel({
  compositions,
  performances,
  loading,
  onPerform,
  onExport,
  onViewPerformance,
}: ConductorPanelProps): ReactElement {
  const [viewMode, setViewMode] = useState<ViewMode>('compositions');

  return (
    <div className="conductor-panel">
      <div className="conductor-header">
        <h3>🎭 Conductor</h3>
      </div>

      <div className="conductor-tabs">
        <button
          className={`conductor-tab ${viewMode === 'compositions' ? 'active' : ''}`}
          onClick={() => setViewMode('compositions')}
        >
          <FiList /> Compositions
        </button>
        <button
          className={`conductor-tab ${viewMode === 'performances' ? 'active' : ''}`}
          onClick={() => setViewMode('performances')}
        >
          <FiClock /> Performances ({performances.length})
        </button>
      </div>

      {loading && (
        <div className="conductor-loading">Loading...</div>
      )}

      {viewMode === 'compositions' && !loading && (
        <div className="conductor-compositions">
          {compositions.length === 0 ? (
            <div className="conductor-empty">
              <p>No compositions available</p>
              <p className="hint">Create compositions in the Composer tab</p>
            </div>
          ) : (
            <ul className="conductor-list">
              {compositions.map((comp) => (
                <li key={comp.id} className="conductor-item">
                  <div className="conductor-item-info">
                    <span className="conductor-item-name">{comp.name || 'Untitled'}</span>
                    <span className="conductor-item-meta">
                      {comp.stanzas?.length || 0} stanzas
                    </span>
                  </div>
                  <div className="conductor-item-actions">
                    <button
                      className="btn-icon-small"
                      onClick={() => onPerform(comp)}
                      title="Perform composition"
                    >
                      <FiPlay />
                    </button>
                    <button
                      className="btn-icon-small"
                      onClick={() => onExport(comp)}
                      title="Export composition"
                    >
                      <FiDownload />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {viewMode === 'performances' && !loading && (
        <div className="conductor-performances">
          {performances.length === 0 ? (
            <div className="conductor-empty">
              <p>No performance history</p>
              <p className="hint">Perform a composition to see results here</p>
            </div>
          ) : (
            <ul className="conductor-list">
              {performances.map((perf) => {
                const StatusIcon = perf.status === 'passed' ? FiCheckCircle : FiXCircle;
                const statusClass = perf.status === 'passed' ? 'success' : 'error';
                
                return (
                  <li
                    key={perf.id}
                    className="conductor-item clickable"
                    onClick={() => onViewPerformance(perf)}
                  >
                    <div className="conductor-item-info">
                      <span className={`conductor-item-status ${statusClass}`}>
                        <StatusIcon />
                      </span>
                      <div className="conductor-item-details">
                        <span className="conductor-item-name">
                          {formatDate(perf.startTime)}
                        </span>
                        <span className="conductor-item-meta">
                          {perf.summary.passed}/{perf.summary.total} passed • {formatDuration(perf.duration)}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
