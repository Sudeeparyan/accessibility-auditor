import React from 'react'

export default function AuditHistory({ history, onSelect }) {
  if (!history || history.length === 0) return null

  const getScoreColor = (score) => {
    if (score >= 90) return '#22c55e'
    if (score >= 70) return '#eab308'
    if (score >= 50) return '#f97316'
    return '#ef4444'
  }

  return (
    <div className="history-section" style={{ marginTop: '2rem' }}>
      <div className="card">
        <div className="card-header">
          <span className="card-title">📋 Audit History</span>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{history.length} audits</span>
        </div>
        <div className="history-list">
          {history.map((item) => (
            <div
              key={item.id}
              className="history-item"
              onClick={() => onSelect(item)}
            >
              <div className="history-url">{item.url}</div>
              <div className="history-score" style={{ color: getScoreColor(item.score) }}>
                {item.score}/100
              </div>
              <div className="history-issues">
                {item.totalIssues} issue{item.totalIssues !== 1 ? 's' : ''}
              </div>
              <div className="history-time">
                {item.duration}s
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
