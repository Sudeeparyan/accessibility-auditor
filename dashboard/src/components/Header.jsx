import React from 'react'

export default function Header({ serverStatus, llmEnabled }) {
  return (
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          <div className="header-logo">♿</div>
          <div>
            <div className="header-title">AccessibilityAI Auditor</div>
            <div className="header-subtitle">WCAG 2.1 Compliance Platform</div>
          </div>
        </div>

        <div className="header-right">
          {llmEnabled && (
            <span className="status-badge connected">
              <span className="status-dot green"></span>
              GPT-4 Enabled
            </span>
          )}
          <span className={`status-badge ${serverStatus === 'connected' ? 'connected' : 'disconnected'}`}>
            <span className={`status-dot ${serverStatus === 'connected' ? 'green' : 'red'}`}></span>
            {serverStatus === 'connected' ? 'API Connected' : serverStatus === 'checking' ? 'Connecting...' : 'API Offline'}
          </span>
        </div>
      </div>
    </header>
  )
}
