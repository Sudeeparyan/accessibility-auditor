const express = require('express');
const cors = require('cors');
const JobManager = require('../orchestrator/job-manager');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

let jobManager;
const auditHistory = []; // In-memory audit history for demo

// Initialize on startup
(async () => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠️  WARNING: OPENAI_API_KEY not found in environment variables');
      console.warn('   LLM analysis will be disabled. Set OPENAI_API_KEY in .env file.');
    }

    jobManager = new JobManager(process.env.OPENAI_API_KEY);
    await jobManager.initialize();
    console.log('✓ Job manager initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize job manager:', error.message);
    process.exit(1);
  }
})();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    llmEnabled: !!process.env.OPENAI_API_KEY
  });
});

// Get API info
app.get('/api/info', (req, res) => {
  res.json({
    name: 'AccessibilityAI Auditor API',
    version: '1.0.0',
    description: 'Automated accessibility compliance platform combining rule-based and LLM analysis',
    endpoints: {
      '/health': 'Health check',
      '/api/info': 'API information',
      '/api/audit': 'POST - Audit a single URL',
      '/api/audit/batch': 'POST - Audit multiple URLs'
    },
    author: 'Sudeep Aryan Gaddameedi'
  });
});

// Single URL audit endpoint
app.post('/api/audit', async (req, res) => {
  const { url, skipLLM } = req.body;

  // Validation
  if (!url) {
    return res.status(400).json({ 
      error: 'URL is required',
      example: { url: 'https://example.com' }
    });
  }

  // Basic URL validation
  try {
    new URL(url);
  } catch (error) {
    return res.status(400).json({ 
      error: 'Invalid URL format',
      provided: url,
      example: 'https://example.com'
    });
  }

  try {
    console.log(`\n📝 API Request: Audit ${url}`);
    
    const results = await jobManager.auditWebsite(url, { skipLLM });
    
    // Store in history
    const historyEntry = {
      id: Date.now().toString(),
      url,
      scannedAt: results.scannedAt,
      duration: results.duration,
      score: results.summary.overallScore,
      complianceLevel: results.summary.complianceLevel,
      totalIssues: results.summary.totalIssues,
      criticalIssues: results.summary.criticalIssues
    };
    auditHistory.unshift(historyEntry);
    if (auditHistory.length > 50) auditHistory.pop();
    
    res.json({
      success: true,
      ...results
    });
  } catch (error) {
    console.error('❌ Audit failed:', error);
    res.status(500).json({ 
      success: false,
      error: 'Audit failed', 
      message: error.message,
      url
    });
  }
});

// Batch audit endpoint
app.post('/api/audit/batch', async (req, res) => {
  const { urls, skipLLM } = req.body;

  // Validation
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ 
      error: 'URLs array is required',
      example: { urls: ['https://example.com', 'https://example.org'] }
    });
  }

  // Limit batch size
  if (urls.length > 10) {
    return res.status(400).json({ 
      error: 'Batch size limited to 10 URLs',
      provided: urls.length,
      limit: 10
    });
  }

  try {
    console.log(`\n📝 API Request: Batch audit ${urls.length} URLs`);
    
    const results = await jobManager.auditMultiplePages(urls, { skipLLM });
    
    const summary = {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    };

    res.json({
      success: true,
      summary,
      results
    });
  } catch (error) {
    console.error('❌ Batch audit failed:', error);
    res.status(500).json({ 
      success: false,
      error: 'Batch audit failed', 
      message: error.message
    });
  }
});

// Get audit history
app.get('/api/audit/history', (req, res) => {
  res.json({
    success: true,
    count: auditHistory.length,
    history: auditHistory
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /health',
      'GET /api/info',
      'POST /api/audit',
      'POST /api/audit/batch'
    ]
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n🛑 SIGTERM received, shutting down gracefully...');
  await jobManager.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n🛑 SIGINT received, shutting down gracefully...');
  await jobManager.close();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 AccessibilityAI Auditor API Server`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Server running on: http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API info: http://localhost:${PORT}/api/info`);
  console.log(`\nLLM Analysis: ${process.env.OPENAI_API_KEY ? '✓ Enabled' : '✗ Disabled'}`);
  console.log(`${'='.repeat(60)}\n`);
});

module.exports = app;
