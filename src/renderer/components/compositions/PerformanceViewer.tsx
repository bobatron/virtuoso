import React from 'react';
import type { ReactElement } from 'react';
import { FiArrowLeft, FiCheckCircle, FiXCircle, FiAlertCircle, FiClock } from 'react-icons/fi';
import type { Performance, StanzaResult } from '../../../types/performance';

interface PerformanceViewerProps {
  performance: Performance;
  compositionName?: string;
  onBack: () => void;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

function getStatusIcon(status: StanzaResult['status']): ReactElement {
  switch (status) {
    case 'passed':
      return <FiCheckCircle className="status-icon success" />;
    case 'failed':
      return <FiXCircle className="status-icon error" />;
    case 'error':
      return <FiAlertCircle className="status-icon error" />;
    case 'skipped':
      return <FiClock className="status-icon muted" />;
    default:
      return <FiClock className="status-icon muted" />;
  }
}

export function PerformanceViewer({
  performance,
  compositionName,
  onBack,
}: PerformanceViewerProps): ReactElement {
  const overallStatus = performance.status === 'passed' ? 'success' : 'error';
  
  return (
    <div className="performance-viewer">
      <div className="performance-viewer-header">
        <button className="btn-icon" onClick={onBack} title="Back to history">
          <FiArrowLeft />
        </button>
        <div className="performance-viewer-title">
          <h4>Performance Results</h4>
          {compositionName && (
            <p className="performance-composition-name">{compositionName}</p>
          )}
        </div>
      </div>

      <div className={`performance-summary ${overallStatus}`}>
        <div className="summary-status">
          {performance.status === 'passed' ? (
            <FiCheckCircle className="summary-icon" />
          ) : (
            <FiXCircle className="summary-icon" />
          )}
          <span className="summary-label">
            {performance.status === 'passed' ? 'Passed' : 'Failed'}
          </span>
        </div>
        <div className="summary-stats">
          <div className="stat">
            <span className="stat-value">{performance.summary.passed}</span>
            <span className="stat-label">Passed</span>
          </div>
          <div className="stat">
            <span className="stat-value">{performance.summary.failed}</span>
            <span className="stat-label">Failed</span>
          </div>
          <div className="stat">
            <span className="stat-value">{formatDuration(performance.duration)}</span>
            <span className="stat-label">Duration</span>
          </div>
        </div>
      </div>

      <div className="performance-details">
        <div className="details-row">
          <span className="details-label">Started:</span>
          <span className="details-value">{formatDate(performance.startTime)}</span>
        </div>
        <div className="details-row">
          <span className="details-label">Ended:</span>
          <span className="details-value">{formatDate(performance.endTime)}</span>
        </div>
      </div>

      <div className="stanza-results">
        <h5>Stanza Results</h5>
        {performance.stanzaResults.length === 0 ? (
          <p className="no-results">No stanza results available</p>
        ) : (
          <ul className="stanza-results-list">
            {performance.stanzaResults.map((result, index) => (
              <li key={result.stanzaId} className={`stanza-result ${result.status}`}>
                <div className="stanza-result-header">
                  {getStatusIcon(result.status)}
                  <span className="stanza-result-index">#{index + 1}</span>
                  <span className="stanza-result-duration">
                    {formatDuration(result.duration)}
                  </span>
                </div>
                
                {result.error && (
                  <div className="stanza-result-error">
                    <span className="error-message">{result.error.message}</span>
                    {result.error.details && (
                      <pre className="error-details">{result.error.details}</pre>
                    )}
                  </div>
                )}

                {result.assertionResults && result.assertionResults.length > 0 && (
                  <div className="assertion-results">
                    {result.assertionResults.map((ar, i) => (
                      <div key={i} className={`assertion-result ${ar.passed ? 'passed' : 'failed'}`}>
                        {ar.passed ? <FiCheckCircle /> : <FiXCircle />}
                        <span>
                          {ar.passed ? 'Assertion passed' : `Expected ${ar.expected}, got ${ar.actual}`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
