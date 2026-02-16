const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Pre-load axe-core source at module level for reliable injection
let axeSource;
try {
  const axePath = require.resolve('axe-core');
  axeSource = fs.readFileSync(axePath, 'utf8');
  console.log(`axe-core loaded from: ${axePath} (${(axeSource.length / 1024).toFixed(0)}KB)`);
} catch (err) {
  console.error('Failed to load axe-core source:', err.message);
}

class AccessibilityScraper {
  constructor() {
    this.browser = null;
  }

  async initialize() {
    console.log('Initializing Puppeteer browser...');
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
    console.log('Browser initialized successfully');
  }

  async scrapePage(url) {
    if (!this.browser) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    const page = await this.browser.newPage();
    
    try {
      console.log(`Navigating to ${url}...`);
      
      // Navigate to page with extended timeout
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      console.log('Page loaded, injecting axe-core...');

      // Inject axe-core by evaluating the source directly (most reliable method)
      if (!axeSource) {
        throw new Error('axe-core source not loaded. Ensure axe-core is installed: npm install axe-core');
      }
      await page.evaluate(axeSource);

      // Verify axe is available
      const axeAvailable = await page.evaluate(() => typeof window.axe !== 'undefined');
      if (!axeAvailable) {
        throw new Error('axe-core failed to initialize in page context');
      }

      console.log('Running axe-core analysis...');

      // Run axe-core accessibility analysis
      const axeResults = await page.evaluate(async () => {
        return await window.axe.run({
          resultTypes: ['violations', 'incomplete'],
          rules: {
            'color-contrast': { enabled: true },
            'image-alt': { enabled: true },
            'label': { enabled: true },
            'link-name': { enabled: true }
          }
        });
      });

      console.log(`Found ${axeResults.violations.length} violations`);

      // Extract page content for LLM analysis
      const content = await page.evaluate(() => ({
        html: document.documentElement.outerHTML,
        text: document.body.innerText,
        title: document.title,
        headings: Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'))
          .map(h => ({ 
            level: h.tagName, 
            text: h.innerText.trim() 
          }))
          .filter(h => h.text.length > 0),
        links: Array.from(document.querySelectorAll('a'))
          .map(a => ({ 
            text: a.innerText.trim(), 
            href: a.href,
            hasAriaLabel: a.hasAttribute('aria-label'),
            ariaLabel: a.getAttribute('aria-label')
          }))
          .filter(l => l.text.length > 0 || l.ariaLabel),
        images: Array.from(document.querySelectorAll('img'))
          .map(img => ({ 
            src: img.src, 
            alt: img.alt || '',
            hasAlt: img.hasAttribute('alt'),
            width: img.width,
            height: img.height
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
            placeholder: input.placeholder
          }))
        })),
        buttons: Array.from(document.querySelectorAll('button')).map(btn => ({
          text: btn.innerText.trim(),
          type: btn.type,
          disabled: btn.disabled,
          ariaLabel: btn.getAttribute('aria-label')
        }))
      }));

      console.log('Capturing screenshot...');

      // Take screenshot (base64 encoded)
      const screenshot = await page.screenshot({ 
        encoding: 'base64',
        fullPage: false, // Just above-the-fold to save memory
        type: 'jpeg',
        quality: 60
      });

      return {
        url,
        timestamp: new Date().toISOString(),
        axeResults,
        content,
        screenshot,
        metadata: {
          viewport: page.viewport(),
          userAgent: await page.evaluate(() => navigator.userAgent)
        }
      };

    } catch (error) {
      console.error(`Error scraping ${url}:`, error.message);
      throw error;
    } finally {
      await page.close();
    }
  }

  async scrapeMultiplePages(urls) {
    const results = [];
    
    for (const url of urls) {
      try {
        const result = await this.scrapePage(url);
        results.push({ success: true, data: result });
      } catch (error) {
        results.push({ 
          success: false, 
          url, 
          error: error.message 
        });
      }
    }

    return results;
  }

  async close() {
    if (this.browser) {
      console.log('Closing browser...');
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = AccessibilityScraper;
