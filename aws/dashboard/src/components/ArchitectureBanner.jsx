import React from 'react'

export default function ArchitectureBanner() {
  return (
    <div className="architecture-banner">
      <div className="architecture-title">
        🏗️ AWS Serverless Architecture
      </div>
      <div className="arch-flow">
        <div className="arch-step">
          <div className="arch-step-title">User Request</div>
          <div className="arch-step-sub">URL Input</div>
        </div>
        <div className="arch-arrow">→</div>
        <div className="arch-step" style={{ borderColor: '#f97316' }}>
          <div className="arch-step-title">API Gateway</div>
          <div className="arch-step-sub">REST API</div>
        </div>
        <div className="arch-arrow">→</div>
        <div className="arch-step" style={{ borderColor: '#f97316' }}>
          <div className="arch-step-title">Lambda #1</div>
          <div className="arch-step-sub">api-handler</div>
        </div>
        <div className="arch-arrow">→</div>
        <div className="arch-step" style={{ borderColor: '#eab308' }}>
          <div className="arch-step-title">SQS Queue</div>
          <div className="arch-step-sub">Async Job Queue</div>
        </div>
        <div className="arch-arrow">→</div>
        <div className="arch-step" style={{ borderColor: '#f97316' }}>
          <div className="arch-step-title">Lambda #2</div>
          <div className="arch-step-sub">audit-consumer</div>
        </div>
        <div className="arch-arrow">→</div>
        <div className="arch-step" style={{ borderColor: '#a855f7' }}>
          <div className="arch-step-title">Puppeteer + GPT-4</div>
          <div className="arch-step-sub">Hybrid Analysis</div>
        </div>
        <div className="arch-arrow">→</div>
        <div className="arch-step" style={{ borderColor: '#3b82f6' }}>
          <div className="arch-step-title">DynamoDB</div>
          <div className="arch-step-sub">Results Storage</div>
        </div>
      </div>
    </div>
  )
}
