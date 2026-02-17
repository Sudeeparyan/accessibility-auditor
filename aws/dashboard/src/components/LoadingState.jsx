import React from 'react'

export default function LoadingState({ step }) {
  return (
    <div className="loading-overlay">
      <div className="loading-spinner"></div>
      <div className="loading-text">Analyzing Accessibility (AWS Lambda)...</div>
      <div className="loading-step">{step}</div>

      <div className="loading-steps">
        <div className={`step-item ${step.includes('Submitting') ? 'active' : step.includes('Puppeteer') || step.includes('GPT') || step.includes('Combining') ? 'done' : ''}`}>
          {step.includes('Puppeteer') || step.includes('GPT') || step.includes('Combining') ? '✅' : '🔄'} Submit to SQS
        </div>
        <div className={`step-item ${step.includes('Puppeteer') ? 'active' : step.includes('GPT') || step.includes('Combining') ? 'done' : ''}`}>
          {step.includes('GPT') || step.includes('Combining') ? '✅' : step.includes('Puppeteer') ? '🔄' : '⏳'} Scrape & axe-core
        </div>
        <div className={`step-item ${step.includes('GPT') ? 'active' : step.includes('Combining') ? 'done' : ''}`}>
          {step.includes('Combining') ? '✅' : step.includes('GPT') ? '🔄' : '⏳'} LLM Analysis
        </div>
        <div className={`step-item ${step.includes('Combining') ? 'active' : ''}`}>
          {step.includes('Combining') ? '🔄' : '⏳'} Save to DynamoDB
        </div>
      </div>
    </div>
  )
}
