const express = require('express');
const cors = require('cors');
const JobManager = require('../orchestrator/job-manager');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

let jobManager;
const auditHistory = [];

(async () => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('OPENAI_API_KEY not set, LLM analysis will be disabled.');
    }

    jobManager = new JobManager(process.env.OPENAI_API_KEY);
    await jobManager.initialize();
    console.log('Job manager initialized');
  } catch (error) {
    console.error('Failed to initialize:', error.message);
    process.exit(1);
  }
})();

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    llmEnabled: !!process.env.OPENAI_API_KEY,
  });
});

app.get('/api/info', (req, res) => {
  res.json({
    name: 'AccessibilityAI Auditor API',
    version: '1.0.0',
    description: 'Hybrid rule-based + LLM accessibility auditing platform',
    endpoints: {
      '/health': 'Health check',
      '/api/info': 'API information',
      '/api/audit': 'POST - Audit a single URL',
      '/api/audit/batch': 'POST - Audit multiple URLs',
      '/api/audit/history': 'GET - Recent audit history',
    },
    author: 'Sudeep Aryan Gaddameedi',
  });
});

app.post('/api/audit', async (req, res) => {
  const { url, skipLLM } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required', example: { url: 'https://example.com' } });
  }
  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL format', provided: url });
  }

  try {
    console.log(`Audit request: ${url}`);
    const results = await jobManager.auditWebsite(url, { skipLLM });

    const auditId = Date.now().toString();

    const historyEntry = {
      auditId,
      id: auditId,
      url,
      scannedAt: results.scannedAt,
      duration: results.duration,
      score: results.summary.overallScore,
      complianceLevel: results.summary.complianceLevel,
      totalIssues: results.summary.totalIssues,
      criticalIssues: results.summary.criticalIssues,
    };

    auditHistory.unshift(historyEntry);
    if (auditHistory.length > 50) auditHistory.pop();

    res.json({ success: true, ...results });
  } catch (error) {
    console.error('Audit failed:', error);
    res.status(500).json({ success: false, error: 'Audit failed', message: error.message, url });
  }
});

app.post('/api/audit/batch', async (req, res) => {
  const { urls, skipLLM } = req.body;

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'URLs array is required' });
  }
  if (urls.length > 10) {
    return res.status(400).json({ error: 'Batch limited to 10 URLs', provided: urls.length });
  }

  try {
    console.log(`Batch audit: ${urls.length} URLs`);
    const results = await jobManager.auditMultiplePages(urls, { skipLLM });

    res.json({
      success: true,
      summary: {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      },
      results,
    });
  } catch (error) {
    console.error('Batch audit failed:', error);
    res.status(500).json({ success: false, error: 'Batch audit failed', message: error.message });
  }
});

app.get('/api/audit/history', (req, res) => {
  res.json({ success: true, count: auditHistory.length, history: auditHistory, source: 'in-memory' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

const shutdown = async (signal) => {
  console.log(`${signal} received, shutting down...`);
  if (jobManager) await jobManager.close();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

app.listen(PORT, () => {
  console.log(`AccessibilityAI Auditor running on http://localhost:${PORT}`);
  console.log(`LLM: ${process.env.OPENAI_API_KEY ? 'Enabled' : 'Disabled'}`);
});

module.exports = app;
