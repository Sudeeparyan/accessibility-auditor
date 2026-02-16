/**
 * server.js — Express REST API for the AccessibilityAI Auditor (Local)
 *
 * Local development entry point. Runs an Express server with in-memory
 * audit history storage. No AWS dependencies required.
 *
 * Endpoints:
 *   GET  /health            → Server health check
 *   GET  /api/info          → API metadata
 *   POST /api/audit         → Audit a single URL  { url, skipLLM? }
 *   POST /api/audit/batch   → Audit multiple URLs  { urls[], skipLLM? }
 *   GET  /api/audit/history → Recent audit history (in-memory)
 */

const express = require('express');
const cors = require('cors');
const JobManager = require('../orchestrator/job-manager');
require('dotenv').config();

// ─── App Setup ───────────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());                            // Allow cross-origin requests from dashboard
app.use(express.json({ limit: '10mb' }));   // Parse JSON bodies (screenshots can be large)

// ─── State ───────────────────────────────────────────────────────────────────
let jobManager;                 // Orchestrates scraping + analysis pipeline
const auditHistory = [];        // In-memory history (fallback when DynamoDB unavailable)

// ─── Initialize on Startup ──────────────────────────────────────────────────
(async () => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠️  OPENAI_API_KEY not set — LLM analysis will be disabled.');
    }

    jobManager = new JobManager(process.env.OPENAI_API_KEY);
    await jobManager.initialize(); // Launches headless browser
    console.log('✓ Job manager initialized');
  } catch (error) {
    console.error('❌ Failed to initialize:', error.message);
    process.exit(1);
  }
})();

// ─── Routes ──────────────────────────────────────────────────────────────────

/** Health check — used by dashboard to show connection status */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    llmEnabled: !!process.env.OPENAI_API_KEY,
  });
});

/** API metadata */
app.get('/api/info', (req, res) => {
  res.json({
    name: 'AccessibilityAI Auditor API',
    version: '1.0.0',
    description: 'Hybrid rule-based + LLM accessibility auditing platform',
    endpoints: {
      '/health': 'Health check',
      '/api/info': 'API information',
      '/api/audit': 'POST — Audit a single URL',
      '/api/audit/batch': 'POST — Audit multiple URLs',
      '/api/audit/history': 'GET — Recent audit history',
    },
    author: 'Sudeep Aryan Gaddameedi',
  });
});

/**
 * POST /api/audit — Run a full accessibility audit on a single URL
 *
 * Body: { url: string, skipLLM?: boolean }
 * Flow: URL → Puppeteer scrape → axe-core scan → GPT-4 analysis → combined report
 */
app.post('/api/audit', async (req, res) => {
  const { url, skipLLM } = req.body;

  // --- Input validation ---
  if (!url) {
    return res.status(400).json({ error: 'URL is required', example: { url: 'https://example.com' } });
  }
  try {
    new URL(url); // Throws if invalid
  } catch {
    return res.status(400).json({ error: 'Invalid URL format', provided: url });
  }

  // --- Run audit pipeline ---
  try {
    console.log(`\n📝 Audit request: ${url}`);
    const results = await jobManager.auditWebsite(url, { skipLLM });

    const auditId = Date.now().toString();

    // Save to in-memory history
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
    console.error('❌ Audit failed:', error);
    res.status(500).json({ success: false, error: 'Audit failed', message: error.message, url });
  }
});

/**
 * POST /api/audit/batch — Audit up to 10 URLs sequentially
 *
 * Body: { urls: string[], skipLLM?: boolean }
 */
app.post('/api/audit/batch', async (req, res) => {
  const { urls, skipLLM } = req.body;

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'URLs array is required' });
  }
  if (urls.length > 10) {
    return res.status(400).json({ error: 'Batch limited to 10 URLs', provided: urls.length });
  }

  try {
    console.log(`\n📝 Batch audit: ${urls.length} URLs`);
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
    console.error('❌ Batch audit failed:', error);
    res.status(500).json({ success: false, error: 'Batch audit failed', message: error.message });
  }
});

/** GET /api/audit/history — Return recent audit results (in-memory) */
app.get('/api/audit/history', (req, res) => {
  res.json({ success: true, count: auditHistory.length, history: auditHistory, source: 'in-memory' });
});

// ─── Error Handling ──────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// ─── Graceful Shutdown ───────────────────────────────────────────────────────

const shutdown = async (signal) => {
  console.log(`\n🛑 ${signal} received, shutting down...`);
  if (jobManager) await jobManager.close();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ─── Start Server ────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`🚀 AccessibilityAI Auditor — http://localhost:${PORT}`);
  console.log(`   LLM: ${process.env.OPENAI_API_KEY ? '✓ Enabled' : '✗ Disabled'}`);
  console.log(`${'='.repeat(50)}\n`);
});

module.exports = app;
