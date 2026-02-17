/**
 * App.jsx — Root component of the AccessibilityAI AWS Dashboard
 *
 * Manages app-level state (server status, audit results, loading, history)
 * and renders the full page layout:
 *   Header → AuditForm → Results panels → Audit history
 */

import React, { useState, useEffect, useCallback } from 'react'
import Header from './components/Header'
import AuditForm from './components/AuditForm'
import LoadingState from './components/LoadingState'
import ScoreGauge from './components/ScoreGauge'
import SeverityBreakdown from './components/SeverityBreakdown'
import WcagCoverage from './components/WcagCoverage'
import SourceBreakdown from './components/SourceBreakdown'
import PageMeta from './components/PageMeta'
import ViolationsTable from './components/ViolationsTable'
import ArchitectureBanner from './components/ArchitectureBanner'
import Welcome from './components/Welcome'
import AuditHistory from './components/AuditHistory'
import ScreenshotPreview from './components/ScreenshotPreview'
import SeverityChart from './components/SeverityChart'
import { checkHealth, runAudit } from './api'

export default function App() {
  const [serverStatus, setServerStatus] = useState('checking')
  const [llmEnabled, setLlmEnabled] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')
  const [error, setError] = useState(null)
  const [results, setResults] = useState(null)
  const [auditHistory, setAuditHistory] = useState([])

  useEffect(() => {
    checkServerHealth()
    const interval = setInterval(checkServerHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  const checkServerHealth = async () => {
    try {
      const health = await checkHealth()
      setServerStatus('connected')
      setLlmEnabled(health.llmEnabled)
    } catch {
      setServerStatus('disconnected')
    }
  }

  const handleAudit = useCallback(async (url, skipLLM) => {
    setLoading(true)
    setError(null)
    setResults(null)
    setLoadingStep('Submitting audit job to SQS queue...')

    try {
      const stepTimer1 = setTimeout(() => {
        setLoadingStep('Lambda processing: Puppeteer scraping + axe-core...')
      }, 3000)
      const stepTimer2 = setTimeout(() => {
        setLoadingStep('Lambda processing: GPT-4o semantic analysis...')
      }, 10000)
      const stepTimer3 = setTimeout(() => {
        setLoadingStep('Combining results & saving to DynamoDB...')
      }, 18000)

      const data = await runAudit(url, skipLLM)
      
      clearTimeout(stepTimer1)
      clearTimeout(stepTimer2)
      clearTimeout(stepTimer3)

      setResults(data)

      setAuditHistory(prev => [{
        id: Date.now().toString(),
        url: data.url,
        score: data.summary.overallScore,
        complianceLevel: data.summary.complianceLevel,
        totalIssues: data.summary.totalIssues,
        duration: data.duration,
        scannedAt: data.scannedAt,
      }, ...prev].slice(0, 20))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setLoadingStep('')
    }
  }, [])

  const handleHistoryClick = (item) => {
    handleAudit(item.url, false)
  }

  return (
    <div className="app">
      <Header serverStatus={serverStatus} llmEnabled={llmEnabled} />

      <main className="main-content">
        <AuditForm
          onAudit={handleAudit}
          loading={loading}
          serverStatus={serverStatus}
          llmEnabled={llmEnabled}
        />

        {error && (
          <div className="error-banner">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {loading && <LoadingState step={loadingStep} />}

        {!loading && !results && !error && (
          <>
            <ArchitectureBanner />
            <Welcome />
          </>
        )}

        {results && !loading && (
          <>
            <div className="results-header">
              <h2>Audit Results — {results.url}</h2>
              <div className="results-meta">
                <span>⏱️ {results.duration}s</span>
                <span>📅 {new Date(results.scannedAt).toLocaleString()}</span>
              </div>
            </div>

            <div className="results-grid">
              <ScoreGauge
                score={results.summary.overallScore}
                level={results.summary.complianceLevel}
              />
              <SeverityBreakdown summary={results.results.summary} />
            </div>

            <div className="results-grid-3">
              <WcagCoverage coverage={results.results.wcagCoverage} />
              <SourceBreakdown sources={results.results.summary.sources} />
              <SeverityChart summary={results.results.summary} />
            </div>

            {results.metadata && (
              <div style={{ marginBottom: '1.5rem' }}>
                <PageMeta
                  metadata={results.metadata}
                  title={results.metadata.pageTitle}
                />
              </div>
            )}

            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div className="card-header">
                <span className="card-title">💡 Recommendation</span>
              </div>
              <div className="recommendation-text">
                {results.summary.recommendation}
              </div>
            </div>

            {results.screenshot && (
              <ScreenshotPreview screenshot={results.screenshot} url={results.url} />
            )}

            <ViolationsTable violations={results.results.violations} />
          </>
        )}

        {auditHistory.length > 0 && (
          <AuditHistory history={auditHistory} onSelect={handleHistoryClick} />
        )}
      </main>
    </div>
  )
}
