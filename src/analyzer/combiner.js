class ResultCombiner {
  combineResults(axeResults, llmResults) {
    const combined = {
      summary: {
        totalViolations: 0,
        critical: 0,
        serious: 0,
        moderate: 0,
        minor: 0,
        sources: {
          axeCore: 0,
          llm: 0
        }
      },
      violations: [],
      wcagCoverage: {},
      complianceScore: 0
    };

    // Process axe-core results (rule-based automated checks)
    if (axeResults && axeResults.violations) {
      axeResults.violations.forEach(v => {
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
            failureSummary: n.failureSummary
          })),
          recommendation: v.help
        });

        combined.summary[v.impact]++;
        combined.summary.totalViolations++;
        combined.summary.sources.axeCore++;
      });
    }

    // Process LLM results (semantic/contextual analysis)
    if (llmResults && llmResults.violations) {
      llmResults.violations.forEach(v => {
        combined.violations.push({
          source: 'llm',
          type: v.type,
          impact: v.severity.toLowerCase(),
          description: v.description,
          recommendation: v.recommendation,
          examples: v.examples || [],
          wcagTags: this.inferWCAGTags(v.type),
          isSemanticIssue: true
        });

        const severity = v.severity.toLowerCase();
        if (combined.summary[severity] !== undefined) {
          combined.summary[severity]++;
        } else {
          combined.summary.moderate++;
        }
        
        combined.summary.totalViolations++;
        combined.summary.sources.llm++;
      });
    }

    // Calculate WCAG coverage and compliance score
    combined.wcagCoverage = this.calculateWCAGCoverage(combined.violations);
    combined.complianceScore = this.calculateComplianceScore(combined.summary);

    // Sort violations by severity
    combined.violations.sort((a, b) => {
      const severityOrder = { critical: 0, serious: 1, moderate: 2, minor: 3 };
      return severityOrder[a.impact] - severityOrder[b.impact];
    });

    return combined;
  }

  inferWCAGTags(violationType) {
    // Map LLM-detected violation types to WCAG guidelines
    const mapping = {
      'unclear-link-text': ['wcag244', 'wcag249'], // 2.4.4 Link Purpose, 2.4.9 Link Purpose (Link Only)
      'complex-language': ['wcag315'], // 3.1.5 Reading Level
      'poor-heading-structure': ['wcag131', 'wcag246'], // 1.3.1 Info and Relationships, 2.4.6 Headings and Labels
      'missing-context': ['wcag332', 'wcag333'], // 3.3.2 Labels or Instructions, 3.3.3 Error Suggestion
      'ambiguous-labels': ['wcag332', 'wcag244', 'wcag246'], // 3.3.2 Labels, 2.4.4 Link Purpose, 2.4.6 Headings
      'confusing-navigation': ['wcag241', 'wcag244'], // 2.4.1 Bypass Blocks, 2.4.4 Link Purpose
      'missing-alt-text': ['wcag111'], // 1.1.1 Non-text Content
      'low-color-contrast': ['wcag143'], // 1.4.3 Contrast (Minimum)
      'missing-form-labels': ['wcag332', 'wcag131'] // 3.3.2 Labels or Instructions, 1.3.1 Info and Relationships
    };

    return mapping[violationType] || [];
  }

  calculateWCAGCoverage(violations) {
    // WCAG 2.1 guidelines by conformance level
    const wcagGuidelines = {
      'A': [
        '1.1.1', '1.2.1', '1.2.2', '1.2.3', '1.3.1', '1.3.2', '1.3.3',
        '1.4.1', '1.4.2', '2.1.1', '2.1.2', '2.1.4', '2.2.1', '2.2.2',
        '2.3.1', '2.4.1', '2.4.2', '2.4.3', '2.4.4', '2.5.1', '2.5.2',
        '2.5.3', '2.5.4', '3.1.1', '3.2.1', '3.2.2', '3.3.1', '3.3.2',
        '4.1.1', '4.1.2', '4.1.3'
      ],
      'AA': [
        '1.2.4', '1.2.5', '1.3.4', '1.3.5', '1.4.3', '1.4.4', '1.4.5',
        '1.4.10', '1.4.11', '1.4.12', '1.4.13', '2.4.5', '2.4.6', '2.4.7',
        '2.5.5', '2.5.6', '3.1.2', '3.2.3', '3.2.4', '3.3.3', '3.3.4'
      ],
      'AAA': [
        '1.2.6', '1.2.7', '1.2.8', '1.2.9', '1.4.6', '1.4.7', '1.4.8',
        '1.4.9', '2.1.3', '2.2.3', '2.2.4', '2.2.5', '2.2.6', '2.3.2',
        '2.3.3', '2.4.8', '2.4.9', '2.4.10', '2.5.5', '2.5.6', '3.1.3',
        '3.1.4', '3.1.5', '3.1.6', '3.2.5', '3.3.5', '3.3.6'
      ]
    };

    const coverage = { A: 0, AA: 0, AAA: 0 };
    
    // Extract all WCAG tags found in violations
    const foundTags = new Set();
    violations.forEach(v => {
      if (v.wcagTags) {
        v.wcagTags.forEach(tag => {
          // Convert format like 'wcag244' to '2.4.4'
          const match = tag.match(/wcag(\d)(\d)(\d)/);
          if (match) {
            foundTags.add(`${match[1]}.${match[2]}.${match[3]}`);
          }
        });
      }
    });

    // Calculate compliance percentage for each level
    Object.keys(wcagGuidelines).forEach(level => {
      const totalGuidelines = wcagGuidelines[level].length;
      const violatedCount = wcagGuidelines[level].filter(g => 
        foundTags.has(g)
      ).length;
      
      // Compliance = (total - violated) / total * 100
      coverage[level] = Math.round(((totalGuidelines - violatedCount) / totalGuidelines) * 100);
    });

    return coverage;
  }

  calculateComplianceScore(summary) {
    // Calculate overall compliance score (0-100)
    // Weighted by severity: critical = -10, serious = -5, moderate = -2, minor = -1
    
    const weights = {
      critical: -10,
      serious: -5,
      moderate: -2,
      minor: -1
    };

    let score = 100;
    
    Object.keys(weights).forEach(severity => {
      score += summary[severity] * weights[severity];
    });

    // Ensure score stays between 0-100
    return Math.max(0, Math.min(100, score));
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
      recommendation: this.getRecommendation(summary, complianceScore)
    };
  }

  getRecommendation(summary, score) {
    if (score >= 90) {
      return 'Excellent! Your site has strong accessibility compliance. Focus on addressing the remaining minor issues.';
    } else if (score >= 70) {
      return 'Good progress, but improvements needed. Prioritize fixing critical and serious violations.';
    } else if (score >= 50) {
      return 'Moderate accessibility. Significant work required to meet WCAG standards. Start with critical violations.';
    } else {
      return 'Poor accessibility. Immediate action required. This site likely violates ADA/Section 508 requirements.';
    }
  }
}

module.exports = ResultCombiner;
