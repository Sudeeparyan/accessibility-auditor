import React, { useState } from 'react'

export default function ScreenshotPreview({ screenshot, url }) {
  const [showFull, setShowFull] = useState(false)

  if (!screenshot) return null

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <div className="card-header">
        <span className="card-title">📸 Page Screenshot</span>
        <button
          className="filter-btn"
          onClick={() => setShowFull(!showFull)}
          style={{ cursor: 'pointer' }}
        >
          {showFull ? 'Collapse' : 'Expand'}
        </button>
      </div>
      <div className="screenshot-container">
        <img
          src={`data:image/jpeg;base64,${screenshot}`}
          alt={`Screenshot of ${url}`}
          className="screenshot-img"
          style={{
            maxHeight: showFull ? 'none' : '300px',
            objectFit: 'cover',
            objectPosition: 'top',
            width: '100%',
          }}
        />
      </div>
    </div>
  )
}
