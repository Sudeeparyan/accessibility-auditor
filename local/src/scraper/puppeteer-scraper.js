/**
 * puppeteer-scraper.js — Fault-tolerant web scraper with retry logic & proxy rotation
 *
 * This module:
 *   1. Launches a headless Chromium browser via Puppeteer
 *   2. Navigates to the target URL with automatic retry & exponential backoff
 *   3. Supports proxy rotation for distributed scraping at scale
 *   4. Injects axe-core (accessibility testing engine) into the page
 *   5. Runs automated WCAG 2.1 rule checks (50+ rules)
 *   6. Extracts page content (headings, links, images, forms, buttons)
 *      for later LLM analysis
 *   7. Takes a screenshot for the dashboard preview
 *
 * Fault tolerance:
 *   - Automatic retry with exponential backoff (up to 3 attempts)
 *   - Proxy rotation pool to avoid IP blocks on high-volume scraping
 *   - Graceful degradation when proxies are unavailable
 *
 * Why axe-core?
 *   - Industry standard for automated accessibility testing
 *   - Catches deterministic issues: missing alt text, color contrast,
 *     missing form labels, broken ARIA attributes, etc.
 *   - Fast and reliable — but can't understand *semantics* (that's the LLM's job)
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

// ─── Pre-load axe-core source at startup ─────────────────────────────────────
// We read the axe-core JS file once and inject it into every page we scrape.
let axeSource;
try {
  const axePath = require.resolve('axe-core');
  axeSource = fs.readFileSync(axePath, 'utf8');
  console.log(`axe-core loaded (${(axeSource.length / 1024).toFixed(0)}KB)`);
} catch (err) {
  console.error('Failed to load axe-core:', err.message);
}

// ─── Retry / Backoff Configuration ───────────────────────────────────────────
const DEFAULT_RETRY_OPTIONS = {
  maxRetries: 3,
  baseDelay: 1000,          // 1 second initial delay
  maxDelay: 10000,          // 10 seconds max delay
  backoffMultiplier: 2,     // Exponential backoff factor
  retryableErrors: [
    'net::ERR_CONNECTION_RESET',
    'net::ERR_CONNECTION_REFUSED',
    'net::ERR_CONNECTION_TIMED_OUT',
    'net::ERR_NAME_NOT_RESOLVED',
    'Navigation timeout',
    'Protocol error',
    'ECONNREFUSED',
    'ETIMEDOUT',
  ],
};

class AccessibilityScraper {
  /**
   * @param {Object} options
   * @param {string[]} options.proxies — List of proxy URLs for rotation (e.g. ['http://proxy1:8080', ...])
   * @param {Object} options.retryOptions — Override default retry settings
   */
  constructor(options = {}) {
    this.browser = null;
    this.proxies = options.proxies || (process.env.PROXY_LIST ? process.env.PROXY_LIST.split(',').map(p => p.trim()) : []);
    this.currentProxyIndex = 0;
    this.retryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options.retryOptions };
  }

  /** Launch headless Chrome (optionally through a proxy) */
  async initialize() {
    console.log('Launching headless browser...');

    const launchArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ];

    // Apply proxy if available
    const proxy = this._getNextProxy();
    if (proxy) {
      launchArgs.push(`--proxy-server=${proxy}`);
      console.log(`Using proxy: ${proxy}`);
    }

    this.browser = await puppeteer.launch({
      headless: 'new',
      args: launchArgs,
    });
    console.log('Browser ready');
  }

  // ─── Proxy Rotation ─────────────────────────────────────────────────────

  /** Rotate to the next proxy in the pool (round-robin) */
  _getNextProxy() {
    if (!this.proxies.length) return null;
    const proxy = this.proxies[this.currentProxyIndex];
    this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxies.length;
    return proxy;
  }

  /** Re-launch browser with a different proxy */
  async _rotateProxy() {
    if (!this.proxies.length) return;
    console.log('Rotating proxy...');
    await this.close();
    await this.initialize();
  }

  // ─── Retry Logic ────────────────────────────────────────────────────────

  /**
   * Execute an async function with automatic retry and exponential backoff
   *
   * @param {Function} fn — Async function to execute
   * @param {string} label — Description for logging
   * @returns {*} Result of fn()
   */
  async _withRetry(fn, label = 'operation') {
    const { maxRetries, baseDelay, maxDelay, backoffMultiplier, retryableErrors } = this.retryOptions;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        const isRetryable = retryableErrors.some(e => error.message.includes(e));

        if (attempt === maxRetries || !isRetryable) {
          console.error(`❌ ${label} failed after ${attempt} attempt(s): ${error.message}`);
          throw error;
        }

        const delay = Math.min(baseDelay * Math.pow(backoffMultiplier, attempt - 1), maxDelay);
        console.warn(`⚠️  ${label} attempt ${attempt}/${maxRetries} failed: ${error.message}`);
        console.warn(`   Retrying in ${delay}ms...`);

        await new Promise(resolve => setTimeout(resolve, delay));

        // Rotate proxy on network failures
        if (this.proxies.length > 0 && isRetryable) {
          await this._rotateProxy();
        }
      }
    }
  }

  /**
   * Scrape a single page and run accessibility analysis
   * Wraps the core logic with automatic retry & proxy rotation.
   *
   * @param {string} url — Full URL to scrape
   * @returns {Object} { url, timestamp, axeResults, content, screenshot, metadata }
   */
  async scrapePage(url) {
    return this._withRetry(() => this._scrapePageCore(url), `Scraping ${url}`);
  }

  /**
   * Core scraping logic (called by scrapePage via retry wrapper)
   *
   * @param {string} url — Full URL to scrape
   * @returns {Object} { url, timestamp, axeResults, content, screenshot, metadata }
   */
  async _scrapePageCore(url) {
    if (!this.browser) throw new Error('Browser not initialized. Call initialize() first.');

    const page = await this.browser.newPage();

    try {
      // ── Navigate to URL ─────────────────────────────────────────────
      console.log(`Navigating to ${url}...`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // ── Inject & run axe-core ───────────────────────────────────────
      if (!axeSource) throw new Error('axe-core not loaded. Run: npm install axe-core');
      await page.evaluate(axeSource); // Inject axe-core library into page

      const axeAvailable = await page.evaluate(() => typeof window.axe !== 'undefined');
      if (!axeAvailable) throw new Error('axe-core failed to initialize');

      console.log('Running axe-core checks...');
      const axeResults = await page.evaluate(async () => {
        return await window.axe.run({
          resultTypes: ['violations', 'incomplete'],
          rules: {
            'color-contrast': { enabled: true },
            'image-alt': { enabled: true },
            'label': { enabled: true },
            'link-name': { enabled: true },
          },
        });
      });
      console.log(`Found ${axeResults.violations.length} violations`);

      // ── Extract page content for LLM analysis ──────────────────────
      // We pull out structured data that GPT-4 can reason about:
      // headings (hierarchy), links (text quality), images (alt text),
      // forms (label presence), buttons (clear labeling)
      const content = await page.evaluate(() => ({
        html: document.documentElement.outerHTML,
        text: document.body.innerText,
        title: document.title,

        headings: Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'))
          .map(h => ({ level: h.tagName, text: h.innerText.trim() }))
          .filter(h => h.text.length > 0),

        links: Array.from(document.querySelectorAll('a'))
          .map(a => ({
            text: a.innerText.trim(),
            href: a.href,
            hasAriaLabel: a.hasAttribute('aria-label'),
            ariaLabel: a.getAttribute('aria-label'),
          }))
          .filter(l => l.text.length > 0 || l.ariaLabel),

        images: Array.from(document.querySelectorAll('img'))
          .map(img => ({
            src: img.src,
            alt: img.alt || '',
            hasAlt: img.hasAttribute('alt'),
            width: img.width,
            height: img.height,
          })),

        forms: Array.from(document.querySelectorAll('form')).map(form => ({
          action: form.action,
          method: form.method,
          inputs: Array.from(form.querySelectorAll('input, textarea, select')).map(input => ({
            type: input.type,
            name: input.name,
            id: input.id,
            hasLabel: !!input.labels?.length,
            ariaLabel: input.getAttribute('aria-label'),
            placeholder: input.placeholder,
          })),
        })),

        buttons: Array.from(document.querySelectorAll('button')).map(btn => ({
          text: btn.innerText.trim(),
          type: btn.type,
          disabled: btn.disabled,
          ariaLabel: btn.getAttribute('aria-label'),
        })),
      }));

      // ── Screenshot ─────────────────────────────────────────────────
      const screenshot = await page.screenshot({
        encoding: 'base64',
        fullPage: false,    // Above-the-fold only to save memory
        type: 'jpeg',
        quality: 60,
      });

      return {
        url,
        timestamp: new Date().toISOString(),
        axeResults,
        content,
        screenshot,
        metadata: {
          viewport: page.viewport(),
          userAgent: await page.evaluate(() => navigator.userAgent),
        },
      };
    } catch (error) {
      console.error(`Error scraping ${url}:`, error.message);
      throw error;
    } finally {
      await page.close();
    }
  }

  /** Close the browser and free memory */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = AccessibilityScraper;
