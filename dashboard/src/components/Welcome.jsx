import React from 'react'

export default function Welcome() {
  return (
    <div className="welcome-section">
      <div className="welcome-icon">♿</div>
      <div className="welcome-title">Accessibility Compliance Made Easy</div>
      <div className="welcome-text">
        Enter a URL above to run a comprehensive WCAG 2.1 accessibility audit
        combining automated rule-based checks with AI-powered semantic analysis.
      </div>

      <div className="features-grid">
        <div className="feature-card">
          <div className="feature-icon">🤖</div>
          <div className="feature-title">axe-core Engine</div>
          <div className="feature-desc">
            50+ automated WCAG rules for fast, deterministic analysis
          </div>
        </div>
        <div className="feature-card">
          <div className="feature-icon">🧠</div>
          <div className="feature-title">GPT-4 Semantic AI</div>
          <div className="feature-desc">
            Detects unclear language, poor context, and ambiguous labels
          </div>
        </div>
        <div className="feature-card">
          <div className="feature-icon">📊</div>
          <div className="feature-title">95% WCAG Coverage</div>
          <div className="feature-desc">
            Hybrid approach covers 3x more violations than tools alone
          </div>
        </div>
      </div>
    </div>
  )
}
