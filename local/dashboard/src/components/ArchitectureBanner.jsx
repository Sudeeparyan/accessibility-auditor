import React from 'react'

export default function ArchitectureBanner() {
  return (
    <div className="architecture-banner">
      <div className="architecture-title">
        🏗️ System Architecture
      </div>
      <div className="arch-flow">
        <div className="arch-step">
          <div className="arch-step-title">User Request</div>
          <div className="arch-step-sub">URL Input</div>
        </div>
        <div className="arch-arrow">→</div>
        <div className="arch-step">
          <div className="arch-step-title">API Gateway</div>
          <div className="arch-step-sub">Express Server</div>
        </div>
        <div className="arch-arrow">→</div>
        <div className="arch-step">
          <div className="arch-step-title">Orchestrator</div>
          <div className="arch-step-sub">Job Manager</div>
        </div>
        <div className="arch-arrow">→</div>
        <div className="arch-step" style={{ borderColor: '#a855f7' }}>
          <div className="arch-step-title">Puppeteer</div>
          <div className="arch-step-sub">Scraping + axe-core</div>
        </div>
        <div className="arch-arrow">+</div>
        <div className="arch-step" style={{ borderColor: '#22c55e' }}>
          <div className="arch-step-title">GPT-4 LLM</div>
          <div className="arch-step-sub">Semantic Analysis</div>
        </div>
        <div className="arch-arrow">→</div>
        <div className="arch-step" style={{ borderColor: '#3b82f6' }}>
          <div className="arch-step-title">Dashboard</div>
          <div className="arch-step-sub">React Visualization</div>
        </div>
      </div>
    </div>
  )
}
