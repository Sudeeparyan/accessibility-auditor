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
    if (this.initialized) {
      console.log('Job manager already initialized');
      return;
    }

    console.log('Initializing job manager...');
    await this.scraper.initialize();
    this.initialized = true;
    console.log('Job manager ready');
  }

  async auditWebsite(url, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Starting accessibility audit for: ${url}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      // Step 1: Scrape page and run axe-core
      console.log('📊 Step 1/3: Scraping page and running automated checks...');
      const scrapedData = await this.scraper.scrapePage(url);
      console.log(`✓ Found ${scrapedData.axeResults.violations.length} automated violations`);
      console.log(`✓ Extracted ${scrapedData.content.links.length} links, ${scrapedData.content.images.length} images, ${scrapedData.content.headings.length} headings\n`);

      // Step 2: LLM semantic analysis (only if enabled)
      let llmResults = { violations: [] };
      if (options.skipLLM !== true) {
        console.log('🤖 Step 2/3: Running AI-powered semantic analysis...');
        llmResults = await this.llmAnalyzer.analyzeContent(scrapedData);
        console.log(`✓ Found ${llmResults.violations?.length || 0} semantic violations\n`);
      } else {
        console.log('⏭️  Step 2/3: Skipping LLM analysis (disabled)\n');
      }

      // Step 3: Combine and analyze results
      console.log('🔄 Step 3/3: Combining results and calculating scores...');
      const combinedResults = this.combiner.combineResults(
        scrapedData.axeResults,
        llmResults
      );

      const summary = this.combiner.generateSummary(combinedResults);
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✓ Analysis complete in ${duration}s\n`);

      // Print summary
      this.printSummary(summary, combinedResults);

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
            buttons: scrapedData.content.buttons.length
          },
          viewport: scrapedData.metadata.viewport,
          userAgent: scrapedData.metadata.userAgent
        }
      };

    } catch (error) {
      console.error('\n❌ Audit failed:', error.message);
      throw error;
    }
  }

  printSummary(summary, results) {
    console.log(`${'='.repeat(60)}`);
    console.log('AUDIT SUMMARY');
    console.log(`${'='.repeat(60)}\n`);
    
    console.log(`Overall Score: ${summary.overallScore}/100`);
    console.log(`Compliance Level: ${summary.complianceLevel}`);
    console.log(`Total Issues: ${summary.totalIssues}\n`);
    
    console.log('Issues by Severity:');
    console.log(`  🔴 Critical: ${summary.criticalIssues}`);
    console.log(`  🟠 Serious: ${results.summary.serious}`);
    console.log(`  🟡 Moderate: ${results.summary.moderate}`);
    console.log(`  🔵 Minor: ${results.summary.minor}\n`);
    
    console.log('WCAG 2.1 Compliance:');
    console.log(`  Level A:   ${results.wcagCoverage.A}%`);
    console.log(`  Level AA:  ${results.wcagCoverage.AA}%`);
    console.log(`  Level AAA: ${results.wcagCoverage.AAA}%\n`);
    
    console.log('Recommendation:');
    console.log(`  ${summary.recommendation}\n`);
    
    console.log(`${'='.repeat(60)}\n`);
  }

  async auditMultiplePages(urls, options = {}) {
    const results = [];
    
    console.log(`Starting batch audit of ${urls.length} pages...\n`);

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      console.log(`\n[${i + 1}/${urls.length}] Processing: ${url}`);
      
      try {
        const result = await this.auditWebsite(url, options);
        results.push({ 
          success: true, 
          url,
          data: result 
        });
      } catch (error) {
        console.error(`Failed to audit ${url}:`, error.message);
        results.push({ 
          success: false, 
          url, 
          error: error.message 
        });
      }

      // Small delay between pages to avoid rate limiting
      if (i < urls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Print batch summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`\n${'='.repeat(60)}`);
    console.log('BATCH AUDIT COMPLETE');
    console.log(`${'='.repeat(60)}`);
    console.log(`Total pages: ${urls.length}`);
    console.log(`Successful: ${successful}`);
    console.log(`Failed: ${failed}\n`);

    return results;
  }

  async close() {
    console.log('Cleaning up resources...');
    await this.scraper.close();
    this.initialized = false;
    console.log('Job manager closed');
  }
}

module.exports = JobManager;
