import React from 'react'

export default function LoadingState({ step }) {
  return (
    <div className="loading-overlay">
      <div className="loading-spinner"></div>
      <div className="loading-text">Analyzing Accessibility...</div>
      <div className="loading-step">{step}</div>

      <div className="loading-steps">
        <div className={`step-item ${step.includes('Scraping') ? 'active' : step.includes('AI') || step.includes('Combining') ? 'done' : ''}`}>
          {step.includes('AI') || step.includes('Combining') ? '✅' : '🔄'} Scrape & axe-core
        </div>
        <div className={`step-item ${step.includes('AI') ? 'active' : step.includes('Combining') ? 'done' : ''}`}>
          {step.includes('Combining') ? '✅' : step.includes('AI') ? '🔄' : '⏳'} LLM Analysis
        </div>
        <div className={`step-item ${step.includes('Combining') ? 'active' : ''}`}>
          {step.includes('Combining') ? '🔄' : '⏳'} Combine Results
        </div>
      </div>
    </div>
  )
}
