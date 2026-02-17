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

  async initialize() {
    if (this.initialized) return;
    console.log('Initializing job manager...');
    await this.scraper.initialize();
    this.initialized = true;
    console.log('Job manager ready');
  }

  async auditWebsite(url, options = {}) {
    if (!this.initialized) await this.initialize();

    const startTime = Date.now();
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Auditing: ${url}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      console.log('Step 1/3: Scraping page and running axe-core...');
      const scrapedData = await this.scraper.scrapePage(url);
      console.log(`  ${scrapedData.axeResults.violations.length} automated violations found`);
      console.log(`  Extracted ${scrapedData.content.links.length} links, ${scrapedData.content.images.length} images\n`);

      let llmResults = { violations: [] };
      if (options.skipLLM !== true) {
        console.log('Step 2/3: Running GPT-4 semantic analysis...');
        llmResults = await this.llmAnalyzer.analyzeContent(scrapedData);
        console.log(`  ${llmResults.violations?.length || 0} semantic violations found\n`);
      } else {
        console.log('Step 2/3: Skipped (LLM disabled)\n');
      }

      console.log('Step 3/3: Combining results and calculating score...');
      const combinedResults = this.combiner.combineResults(scrapedData.axeResults, llmResults);
      const summary = this.combiner.generateSummary(combinedResults);

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`  Done in ${duration}s\n`);

      this._printSummary(summary, combinedResults);

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
      console.error('\nAudit failed:', error.message);
      throw error;
    }
  }

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

      if (i < urls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const ok = results.filter(r => r.success).length;
    console.log(`\nBatch complete: ${ok}/${urls.length} succeeded\n`);
    return results;
  }

  async close() {
    await this.scraper.close();
    this.initialized = false;
    console.log('Job manager closed');
  }

  _printSummary(summary, results) {
    console.log('─'.repeat(40));
    console.log(`Score: ${summary.overallScore}/100  |  Level: ${summary.complianceLevel}  |  Issues: ${summary.totalIssues}`);
    console.log(`  Critical: ${summary.criticalIssues}  Serious: ${results.summary.serious}  Moderate: ${results.summary.moderate}  Minor: ${results.summary.minor}`);
    console.log(`  WCAG A: ${results.wcagCoverage.A}%  AA: ${results.wcagCoverage.AA}%  AAA: ${results.wcagCoverage.AAA}%`);
    console.log('─'.repeat(40) + '\n');
  }
}

module.exports = JobManager;
