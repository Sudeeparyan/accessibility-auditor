import React from 'react'

export default function WcagCoverage({ coverage }) {
  const getColor = (pct) => {
    if (pct >= 90) return '#22c55e'
    if (pct >= 70) return '#eab308'
    return '#ef4444'
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">🏆 WCAG 2.1 Coverage</span>
      </div>
      <div className="wcag-levels">
        {['A', 'AA', 'AAA'].map((level) => {
          const pct = coverage[level] || 0
          return (
            <div className="wcag-level" key={level}>
              <div className="wcag-level-label">Level {level}</div>
              <div className="wcag-level-value" style={{ color: getColor(pct) }}>
                {pct}%
              </div>
              <div className="wcag-level-bar">
                <div
                  className="wcag-level-bar-fill"
                  style={{
                    width: `${pct}%`,
                    background: getColor(pct),
                  }}
                ></div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
