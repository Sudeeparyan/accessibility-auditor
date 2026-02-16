import React, { useState, useEffect } from 'react'

const QUICK_URLS = [
  'https://example.com',
  'https://en.wikipedia.org',
  'https://www.w3.org',
  'https://github.com',
]

export default function AuditForm({ onAudit, loading, serverStatus, llmEnabled }) {
  const [url, setUrl] = useState('')
  const [skipLLM, setSkipLLM] = useState(!llmEnabled)

  // Sync skipLLM when health check updates llmEnabled
  useEffect(() => {
    setSkipLLM(!llmEnabled)
  }, [llmEnabled])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!url.trim() || loading) return
    onAudit(url.trim(), skipLLM)
  }

  const handleQuickUrl = (quickUrl) => {
    setUrl(quickUrl)
    onAudit(quickUrl, skipLLM)
  }

  return (
    <div className="audit-section">
      <form className="audit-form" onSubmit={handleSubmit}>
        <div className="audit-form-header">
          <span className="icon">🔍</span>
          <h2>Run Accessibility Audit</h2>
        </div>

        <div className="input-group">
          <input
            type="url"
            className="url-input"
            placeholder="Enter website URL to audit (e.g., https://example.com)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
            required
          />
          <button
            type="submit"
            className="audit-btn"
            disabled={loading || serverStatus !== 'connected' || !url.trim()}
          >
            {loading ? (
              <>
                <span className="loading-spinner" style={{ width: 18, height: 18, borderWidth: 2, margin: 0 }}></span>
                Auditing...
              </>
            ) : (
              <>🚀 Start Audit</>
            )}
          </button>
        </div>

        <div className="options-row">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={skipLLM}
              onChange={(e) => setSkipLLM(e.target.checked)}
            />
            Skip LLM Analysis (faster, rule-based only)
          </label>

          <div className="quick-urls">
            <span>Quick test:</span>
            {QUICK_URLS.map((u) => (
              <button
                key={u}
                type="button"
                className="quick-url-btn"
                onClick={() => handleQuickUrl(u)}
                disabled={loading}
              >
                {new URL(u).hostname}
              </button>
            ))}
          </div>
        </div>
      </form>
    </div>
  )
}
