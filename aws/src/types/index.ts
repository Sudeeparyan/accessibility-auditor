/**
 * Type definitions for the accessibility auditor modules
 *
 * These JSDoc-compatible types provide TypeScript support for
 * the existing JavaScript modules without requiring full conversion.
 */

/** axe-core violation from automated scanning */
export interface AxeViolation {
  id: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  help: string;
  helpUrl: string;
  tags: string[];
  nodes: AxeViolationNode[];
}

export interface AxeViolationNode {
  html: string;
  target: string[];
  failureSummary: string;
}

export interface AxeResults {
  violations: AxeViolation[];
  incomplete: any[];
  passes: any[];
  inapplicable: any[];
}

/** LLM-detected semantic violation */
export interface LLMViolation {
  type: string;
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  recommendation: string;
  examples: string[];
}

export interface LLMAnalysisResult {
  violations: LLMViolation[];
  skipped?: boolean;
  reason?: string;
  error?: string;
}

/** Combined violation (unified format from both sources) */
export interface CombinedViolation {
  source: 'axe-core' | 'llm';
  id?: string;
  type: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  help?: string;
  helpUrl?: string;
  wcagTags: string[];
  nodes?: number;
  examples: any[];
  recommendation: string;
  isSemanticIssue?: boolean;
}

/** Combined audit results */
export interface CombinedResults {
  summary: {
    totalViolations: number;
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
    sources: {
      axeCore: number;
      llm: number;
    };
  };
  violations: CombinedViolation[];
  wcagCoverage: {
    A: number;
    AA: number;
    AAA: number;
  };
  complianceScore: number;
}

/** Scraped page data from Puppeteer */
export interface ScrapedPageData {
  url: string;
  timestamp: string;
  axeResults: AxeResults;
  content: {
    html: string;
    text: string;
    title: string;
    headings: Array<{ level: string; text: string }>;
    links: Array<{ text: string; href: string; hasAriaLabel: boolean; ariaLabel: string | null }>;
    images: Array<{ src: string; alt: string; hasAlt: boolean; width: number; height: number }>;
    forms: Array<{
      action: string;
      method: string;
      inputs: Array<{
        type: string;
        name: string;
        id: string;
        hasLabel: boolean;
        ariaLabel: string | null;
        placeholder: string;
      }>;
    }>;
    buttons: Array<{
      text: string;
      type: string;
      disabled: boolean;
      ariaLabel: string | null;
    }>;
  };
  screenshot: string;
  metadata: {
    viewport: { width: number; height: number };
    userAgent: string;
  };
}

/** Full audit report returned to clients */
export interface AuditReport {
  url: string;
  scannedAt: string;
  duration: number;
  results: CombinedResults;
  summary: {
    overallScore: number;
    complianceLevel: string;
    totalIssues: number;
    criticalIssues: number;
    recommendation: string;
  };
  screenshot: string | null;
  metadata: {
    pageTitle: string;
    totalElements: {
      headings: number;
      links: number;
      images: number;
      forms: number;
      buttons: number;
    };
    viewport: { width: number; height: number };
    userAgent: string;
  };
}

/** Retry configuration for fault-tolerant scraping */
export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

/** Scraper constructor options */
export interface ScraperOptions {
  proxies?: string[];
  retryOptions?: Partial<RetryOptions>;
}
