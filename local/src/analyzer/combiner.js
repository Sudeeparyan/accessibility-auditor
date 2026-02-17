class ResultCombiner {
  combineResults(axeResults, llmResults) {
    const combined = {
      summary: {
        totalViolations: 0,
        critical: 0, serious: 0, moderate: 0, minor: 0,
        sources: { axeCore: 0, llm: 0 },
      },
      violations: [],
      wcagCoverage: {},
      complianceScore: 0,
    };

    if (axeResults?.violations) {
      for (const v of axeResults.violations) {
        combined.violations.push({
          source: 'axe-core',
          id: v.id,
          type: v.id,
          impact: v.impact || 'moderate',
          description: v.description,
          help: v.help,
          helpUrl: v.helpUrl,
          wcagTags: v.tags.filter(t => t.startsWith('wcag')),
          nodes: v.nodes.length,
          examples: v.nodes.slice(0, 3).map(n => ({
            html: n.html,
            target: n.target.join(' > '),
            failureSummary: n.failureSummary,
          })),
          recommendation: v.help,
        });

        combined.summary[v.impact]++;
        combined.summary.totalViolations++;
        combined.summary.sources.axeCore++;
      }
    }

    if (llmResults?.violations) {
      for (const v of llmResults.violations) {
        const severity = v.severity.toLowerCase();
        combined.violations.push({
          source: 'llm',
          type: v.type,
          impact: severity,
          description: v.description,
          recommendation: v.recommendation,
          examples: v.examples || [],
          wcagTags: this._inferWCAGTags(v.type),
          isSemanticIssue: true,
        });

        if (combined.summary[severity] !== undefined) {
          combined.summary[severity]++;
        } else {
          combined.summary.moderate++;
        }
        combined.summary.totalViolations++;
        combined.summary.sources.llm++;
      }
    }

    combined.wcagCoverage = this._calculateWCAGCoverage(combined.violations);
    combined.complianceScore = this._calculateScore(combined.summary);

    const order = { critical: 0, serious: 1, moderate: 2, minor: 3 };
    combined.violations.sort((a, b) => order[a.impact] - order[b.impact]);

    return combined;
  }

  generateSummary(combinedResults) {
    const { summary, complianceScore, wcagCoverage } = combinedResults;

    let level = 'Not Compliant';
    if (wcagCoverage.AAA >= 90) level = 'AAA';
    else if (wcagCoverage.AA >= 90) level = 'AA';
    else if (wcagCoverage.A >= 90) level = 'A';

    return {
      overallScore: complianceScore,
      complianceLevel: level,
      totalIssues: summary.totalViolations,
      criticalIssues: summary.critical,
      recommendation: this._getRecommendation(complianceScore),
    };
  }

  _inferWCAGTags(violationType) {
    const mapping = {
      'unclear-link-text':      ['wcag244', 'wcag249'],
      'complex-language':       ['wcag315'],
      'poor-heading-structure': ['wcag131', 'wcag246'],
      'missing-context':        ['wcag332', 'wcag333'],
      'ambiguous-labels':       ['wcag332', 'wcag244', 'wcag246'],
      'confusing-navigation':   ['wcag241', 'wcag244'],
      'missing-alt-text':       ['wcag111'],
      'low-color-contrast':     ['wcag143'],
      'missing-form-labels':    ['wcag332', 'wcag131'],
    };
    return mapping[violationType] || [];
  }

  _calculateWCAGCoverage(violations) {
    const guidelines = {
      A: ['1.1.1','1.2.1','1.2.2','1.2.3','1.3.1','1.3.2','1.3.3','1.4.1','1.4.2',
          '2.1.1','2.1.2','2.1.4','2.2.1','2.2.2','2.3.1','2.4.1','2.4.2','2.4.3',
          '2.4.4','2.5.1','2.5.2','2.5.3','2.5.4','3.1.1','3.2.1','3.2.2','3.3.1',
          '3.3.2','4.1.1','4.1.2','4.1.3'],
      AA: ['1.2.4','1.2.5','1.3.4','1.3.5','1.4.3','1.4.4','1.4.5','1.4.10','1.4.11',
           '1.4.12','1.4.13','2.4.5','2.4.6','2.4.7','2.5.5','2.5.6','3.1.2','3.2.3',
           '3.2.4','3.3.3','3.3.4'],
      AAA: ['1.2.6','1.2.7','1.2.8','1.2.9','1.4.6','1.4.7','1.4.8','1.4.9','2.1.3',
            '2.2.3','2.2.4','2.2.5','2.2.6','2.3.2','2.3.3','2.4.8','2.4.9','2.4.10',
            '2.5.5','2.5.6','3.1.3','3.1.4','3.1.5','3.1.6','3.2.5','3.3.5','3.3.6'],
    };

    const violated = new Set();
    for (const v of violations) {
      for (const tag of (v.wcagTags || [])) {
        const m = tag.match(/wcag(\d)(\d)(\d)/);
        if (m) violated.add(`${m[1]}.${m[2]}.${m[3]}`);
      }
    }

    const coverage = {};
    for (const [level, criteria] of Object.entries(guidelines)) {
      const fails = criteria.filter(c => violated.has(c)).length;
      coverage[level] = Math.round(((criteria.length - fails) / criteria.length) * 100);
    }
    return coverage;
  }

  _calculateScore(summary) {
    const weights = { critical: -10, serious: -5, moderate: -2, minor: -1 };
    let score = 100;
    for (const [sev, weight] of Object.entries(weights)) {
      score += summary[sev] * weight;
    }
    return Math.max(0, Math.min(100, score));
  }

  _getRecommendation(score) {
    if (score >= 90) return 'Excellent accessibility compliance. Focus on remaining minor issues.';
    if (score >= 70) return 'Good progress. Prioritize fixing critical and serious violations.';
    if (score >= 50) return 'Moderate accessibility. Significant work needed, start with critical violations.';
    return 'Poor accessibility. Immediate action required, likely violates ADA/Section 508.';
  }
}

module.exports = ResultCombiner;
