import React, { useState } from 'react'

export default function ViolationsTable({ violations }) {
  const [filter, setFilter] = useState('all')
  const [expandedId, setExpandedId] = useState(null)

  const handleFilterChange = (f) => {
    setFilter(f)
    setExpandedId(null)
  }

  const filtered = filter === 'all'
    ? violations
    : violations.filter(v => v.impact === filter)

  return (
    <div className="violations-section">
      <div className="violations-table-container">
        <div className="violations-table-header">
          <h3>
            🐛 Violations Detail ({filtered.length})
          </h3>
          <div className="filter-group">
            {['all', 'critical', 'serious', 'moderate', 'minor'].map(f => (
              <button
                key={f}
                className={`filter-btn ${filter === f ? 'active' : ''}`}
                onClick={() => handleFilterChange(f)}
              >
                {f === 'all' ? `All (${violations.length})` : `${f.charAt(0).toUpperCase() + f.slice(1)}`}
              </button>
            ))}
          </div>
        </div>

        <div className="violations-list">
          {filtered.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
              No violations matching this filter.
            </div>
          ) : (
            filtered.map((v, idx) => {
              const isExpanded = expandedId === idx
              return (
                <div
                  key={idx}
                  className={`violation-item ${isExpanded ? 'expanded' : ''}`}
                  onClick={() => setExpandedId(isExpanded ? null : idx)}
                >
                  <div className="violation-header">
                    <span className={`violation-severity-badge ${v.impact}`}>
                      {v.impact}
                    </span>
                    <span className={`violation-source-badge ${v.source === 'axe-core' ? 'axe' : 'llm'}`}>
                      {v.source === 'axe-core' ? '🤖 axe-core' : '🧠 LLM'}
                    </span>
                    <span className="violation-title">{v.type || v.id}</span>
                  </div>
                  <div className="violation-description">{v.description}</div>

                  {isExpanded && (
                    <div className="violation-details">
                      <div className="violation-detail-row">
                        <span className="violation-detail-label">Fix:</span>
                        <span className="violation-detail-value">{v.recommendation || v.help}</span>
                      </div>

                      {v.helpUrl && (
                        <div className="violation-detail-row">
                          <span className="violation-detail-label">Learn more:</span>
                          <span className="violation-detail-value">
                            <a href={v.helpUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>
                              {v.helpUrl}
                            </a>
                          </span>
                        </div>
                      )}

                      {v.nodes > 0 && (
                        <div className="violation-detail-row">
                          <span className="violation-detail-label">Affected:</span>
                          <span className="violation-detail-value">{v.nodes} element{v.nodes > 1 ? 's' : ''}</span>
                        </div>
                      )}

                      {v.examples && v.examples.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <span className="violation-detail-label">Examples:</span>
                          {v.examples.map((ex, i) => (
                            <div key={i}>
                              {typeof ex === 'string' ? (
                                <div className="violation-code">{ex}</div>
                              ) : ex.html ? (
                                <div className="violation-code">{ex.html}</div>
                              ) : null}
                              {ex.target && (
                                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
                                  Selector: {ex.target}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {v.wcagTags && v.wcagTags.length > 0 && (
                        <div className="violation-wcag-tags">
                          {v.wcagTags.map((tag, i) => (
                            <span key={i} className="wcag-tag">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
