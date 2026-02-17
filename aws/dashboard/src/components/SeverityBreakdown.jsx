import React from 'react'

const severities = [
  { key: 'critical', label: 'Critical', color: '#ef4444' },
  { key: 'serious', label: 'Serious', color: '#f97316' },
  { key: 'moderate', label: 'Moderate', color: '#eab308' },
  { key: 'minor', label: 'Minor', color: '#3b82f6' },
]

export default function SeverityBreakdown({ summary }) {
  const total = summary.totalViolations || 1

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">🎯 Issues by Severity</span>
        <span style={{ fontSize: '1.4rem', fontWeight: 700 }}>
          {summary.totalViolations} total
        </span>
      </div>
      <div className="severity-stats">
        {severities.map(({ key, label, color }) => (
          <div className="severity-row" key={key}>
            <div className={`severity-indicator ${key}`}></div>
            <span className="severity-label">{label}</span>
            <div className="severity-bar-bg">
              <div
                className={`severity-bar-fill ${key}`}
                style={{ width: `${((summary[key] || 0) / total) * 100}%` }}
              ></div>
            </div>
            <span className="severity-count" style={{ color }}>
              {summary[key] || 0}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
