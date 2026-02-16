/**
 * job-manager.js — Orchestrator that coordinates the full audit pipeline
 *
 * This is the "brain" of the system. It ties together:
 *   1. AccessibilityScraper  → Loads page via Puppeteer, runs axe-core
 *   2. LLMAnalyzer           → Sends page content to GPT-4 for semantic checks
 *   3. ResultCombiner        → Merges both result sets, calculates compliance score
 *
 * Usage:
 *   const mgr = new JobManager(OPENAI_API_KEY);
 *   await mgr.initialize();
 *   const report = await mgr.auditWebsite('https://example.com');
 */

const AccessibilityScraper = require('../scraper/puppeteer-scraper');
const LLMAnalyzer = require('../analyzer/llm-analyzer');
const ResultCombiner = require('../analyzer/combiner');

class JobManager {
  constructor(openaiKey) {
    this.scraper = new AccessibilityScraper();
    this.llmAnalyzer = new LLMAnalyzer(openaiKey);
    this.combiner = new ResultCombiner();
    this.initialized = false;
  }

  /** Launch headless browser (must be called before auditing) */
  async initialize() {
    if (this.initialized) return;
    console.log('Initializing job manager...');
    await this.scraper.initialize();
    this.initialized = true;
    console.log('Job manager ready');
  }

  /**
   * Run a complete audit on a single URL
   *
   * Pipeline:
   *   Step 1 — Scrape page with Puppeteer and run axe-core (rule-based)
   *   Step 2 — Send content to GPT-4 for semantic analysis (optional)
   *   Step 3 — Combine results, calculate WCAG score & compliance level
   *
   * @param {string} url  — The URL to audit
   * @param {Object} options
   * @param {boolean} options.skipLLM — If true, skip GPT-4 analysis (faster)
   * @returns {Object} Full audit report with score, violations, metadata
   */
  async auditWebsite(url, options = {}) {
    if (!this.initialized) await this.initialize();

    const startTime = Date.now();
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Auditing: ${url}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      // ── Step 1: Scrape + axe-core ──────────────────────────────────────
      console.log('📊 Step 1/3: Scraping page & running axe-core...');
      const scrapedData = await this.scraper.scrapePage(url);
      console.log(`   ✓ ${scrapedData.axeResults.violations.length} automated violations found`);
      console.log(`   ✓ Extracted ${scrapedData.content.links.length} links, ${scrapedData.content.images.length} images\n`);

      // ── Step 2: LLM semantic analysis (optional) ──────────────────────
      let llmResults = { violations: [] };
      if (options.skipLLM !== true) {
        console.log('🤖 Step 2/3: Running GPT-4 semantic analysis...');
        llmResults = await this.llmAnalyzer.analyzeContent(scrapedData);
        console.log(`   ✓ ${llmResults.violations?.length || 0} semantic violations found\n`);
      } else {
        console.log('⏭️  Step 2/3: Skipped (LLM disabled)\n');
      }

      // ── Step 3: Combine & score ───────────────────────────────────────
      console.log('🔄 Step 3/3: Combining results & calculating score...');
      const combinedResults = this.combiner.combineResults(scrapedData.axeResults, llmResults);
      const summary = this.combiner.generateSummary(combinedResults);

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`   ✓ Done in ${duration}s\n`);

      this._printSummary(summary, combinedResults);

      // ── Build response object ─────────────────────────────────────────
      return {
        url,
        scannedAt: scrapedData.timestamp,
        duration: parseFloat(duration),
        results: combinedResults,
        summary,
        screenshot: scrapedData.screenshot || null,
        metadata: {
          pageTitle: scrapedData.content.title,
          totalElements: {
            headings: scrapedData.content.headings.length,
            links: scrapedData.content.links.length,
            images: scrapedData.content.images.length,
            forms: scrapedData.content.forms.length,
            buttons: scrapedData.content.buttons.length,
          },
          viewport: scrapedData.metadata.viewport,
          userAgent: scrapedData.metadata.userAgent,
        },
      };
    } catch (error) {
      console.error('\n❌ Audit failed:', error.message);
      throw error;
    }
  }

  /**
   * Audit multiple URLs sequentially (batch mode)
   * @param {string[]} urls
   * @param {Object} options
   * @returns {Array<{success, url, data?, error?}>}
   */
  async auditMultiplePages(urls, options = {}) {
    console.log(`\nBatch audit: ${urls.length} pages\n`);
    const results = [];

    for (let i = 0; i < urls.length; i++) {
      console.log(`[${i + 1}/${urls.length}] ${urls[i]}`);
      try {
        const data = await this.auditWebsite(urls[i], options);
        results.push({ success: true, url: urls[i], data });
      } catch (error) {
        results.push({ success: false, url: urls[i], error: error.message });
      }

      // Delay between pages to avoid rate-limiting
      if (i < urls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const ok = results.filter(r => r.success).length;
    console.log(`\nBatch complete: ${ok}/${urls.length} succeeded\n`);
    return results;
  }

  /** Close the headless browser and free resources */
  async close() {
    await this.scraper.close();
    this.initialized = false;
    console.log('Job manager closed');
  }

  // ─── Private ────────────────────────────────────────────────────────────
  _printSummary(summary, results) {
    console.log(`${'─'.repeat(40)}`);
    console.log(`Score: ${summary.overallScore}/100  |  Level: ${summary.complianceLevel}  |  Issues: ${summary.totalIssues}`);
    console.log(`  Critical: ${summary.criticalIssues}  Serious: ${results.summary.serious}  Moderate: ${results.summary.moderate}  Minor: ${results.summary.minor}`);
    console.log(`  WCAG A: ${results.wcagCoverage.A}%  AA: ${results.wcagCoverage.AA}%  AAA: ${results.wcagCoverage.AAA}%`);
    console.log(`${'─'.repeat(40)}\n`);
  }
}

module.exports = JobManager;
