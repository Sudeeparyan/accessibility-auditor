import React from 'react'

export default function SourceBreakdown({ sources }) {
  const safeSource = sources || { axeCore: 0, llm: 0 }
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">🔬 Detection Sources</span>
      </div>
      <div className="source-breakdown">
        <div className="source-item">
          <div className="source-icon">🤖</div>
          <div className="source-name">axe-core</div>
          <div className="source-count" style={{ color: '#a855f7' }}>
            {safeSource.axeCore}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 4 }}>
            Rule-based
          </div>
        </div>
        <div className="source-item">
          <div className="source-icon">🧠</div>
          <div className="source-name">GPT-4 LLM</div>
          <div className="source-count" style={{ color: '#22c55e' }}>
            {safeSource.llm}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 4 }}>
            Semantic AI
          </div>
        </div>
      </div>
    </div>
  )
}
