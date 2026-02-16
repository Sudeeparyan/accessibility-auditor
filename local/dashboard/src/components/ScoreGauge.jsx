import React from 'react'

export default function ScoreGauge({ score, level }) {
  const radius = 75
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  const getColor = (s) => {
    if (s >= 90) return '#22c55e'
    if (s >= 70) return '#eab308'
    if (s >= 50) return '#f97316'
    return '#ef4444'
  }

  const getBadgeClass = (s) => {
    if (s >= 90) return 'excellent'
    if (s >= 70) return 'good'
    return 'poor'
  }

  const color = getColor(score)

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">📊 Compliance Score</span>
      </div>
      <div className="score-container">
        <div className="score-circle">
          <svg width="180" height="180" viewBox="0 0 180 180">
            <circle
              className="track"
              cx="90"
              cy="90"
              r={radius}
            />
            <circle
              className="progress"
              cx="90"
              cy="90"
              r={radius}
              stroke={color}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="score-value">
            <div className="score-number" style={{ color }}>{score}</div>
            <div className="score-label">out of 100</div>
          </div>
        </div>

        <div className={`compliance-badge ${getBadgeClass(score)}`}>
          {score >= 90 ? '🛡️' : score >= 70 ? '⚡' : '⚠️'} {level}
        </div>
      </div>
    </div>
  )
}
