import React from 'react'

export default function PageMeta({ metadata, title }) {
  const elements = metadata.totalElements || {}

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">📄 Page Information</span>
        <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{title}</span>
      </div>
      <div className="page-meta">
        <div className="meta-item">
          <div className="meta-value">{elements.headings || 0}</div>
          <div className="meta-label">Headings</div>
        </div>
        <div className="meta-item">
          <div className="meta-value">{elements.links || 0}</div>
          <div className="meta-label">Links</div>
        </div>
        <div className="meta-item">
          <div className="meta-value">{elements.images || 0}</div>
          <div className="meta-label">Images</div>
        </div>
        <div className="meta-item">
          <div className="meta-value">{elements.forms || 0}</div>
          <div className="meta-label">Forms</div>
        </div>
        <div className="meta-item">
          <div className="meta-value">{elements.buttons || 0}</div>
          <div className="meta-label">Buttons</div>
        </div>
      </div>
    </div>
  )
}
