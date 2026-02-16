const OpenAI = require('openai');

class LLMAnalyzer {
  constructor(apiKey) {
    this.enabled = !!apiKey;
    if (this.enabled) {
      this.openai = new OpenAI({ apiKey });
    } else {
      console.warn('LLMAnalyzer: No API key provided. Semantic analysis will be disabled.');
    }
  }

  async analyzeContent(pageData) {
    if (!this.enabled) {
      return { violations: [], skipped: true, reason: 'No API key configured' };
    }

    const prompt = this.buildPrompt(pageData);
    
    try {
      console.log('Sending content to GPT-4o-mini for semantic analysis...');
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an expert WCAG 2.1 accessibility auditor. Analyze web content for accessibility issues that automated tools cannot detect.

Focus on semantic and contextual violations:
1. **Unclear link text**: Links with text like "click here", "read more", "here" without context
2. **Complex language**: Text that's too complex (target 8th grade reading level)
3. **Poor heading structure**: Skipped heading levels, misleading headings, too many H1s
4. **Missing context**: Form errors, buttons, or instructions that lack clear meaning
5. **Ambiguous labels**: Buttons or form fields with unclear purposes

Return ONLY valid JSON in this exact format:
{
  "violations": [
    {
      "type": "unclear-link-text",
      "severity": "serious",
      "description": "Specific description of the issue",
      "recommendation": "How to fix it",
      "examples": ["Example 1", "Example 2"]
    }
  ]
}

Severity levels: critical, serious, moderate, minor`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content);
      console.log(`GPT-4 found ${result.violations?.length || 0} semantic violations`);
      
      return result;

    } catch (error) {
      console.error('LLM analysis failed:', error.message);
      
      // Return empty results on error rather than failing completely
      return {
        violations: [],
        error: error.message
      };
    }
  }

  buildPrompt(pageData) {
    const { content } = pageData;
    
    // Truncate content to fit in token limits
    const maxTextLength = 2000;
    const truncatedText = content.text.substring(0, maxTextLength);
    
    return `
Analyze this webpage for accessibility issues:

**PAGE TITLE**: ${content.title}

**HEADING STRUCTURE**:
${content.headings.slice(0, 15).map(h => `${h.level}: ${h.text}`).join('\n')}

**LINKS** (first 20):
${content.links.slice(0, 20).map(l => {
  if (l.ariaLabel) {
    return `"${l.text}" (aria-label: "${l.ariaLabel}") -> ${l.href}`;
  }
  return `"${l.text}" -> ${l.href}`;
}).join('\n')}

**IMAGES** (first 10):
${content.images.slice(0, 10).map((i, idx) => {
  const altStatus = i.hasAlt ? `alt="${i.alt}"` : 'NO ALT TEXT';
  return `${idx + 1}. ${altStatus} | src=${i.src.substring(0, 50)}`;
}).join('\n')}

**FORM FIELDS**:
${content.forms.map((form, idx) => `
Form ${idx + 1}: ${form.action}
${form.inputs.map(input => {
  const labelStatus = input.hasLabel ? '✓ has label' : (input.ariaLabel ? `aria-label="${input.ariaLabel}"` : '✗ NO LABEL');
  return `  - ${input.type} (${input.name || input.id || 'unnamed'}) ${labelStatus}`;
}).join('\n')}
`).join('\n')}

**BUTTONS**:
${content.buttons.slice(0, 10).map(b => {
  const label = b.ariaLabel ? `aria-label="${b.ariaLabel}"` : b.text;
  return `"${label || 'NO TEXT'}" (${b.type})`;
}).join('\n')}

**PAGE TEXT** (first ${maxTextLength} characters):
${truncatedText}

---

Find accessibility violations in the above content. Focus on issues that axe-core cannot detect.
    `.trim();
  }

  categorizeViolations(violations) {
    const categorized = {
      critical: [],
      serious: [],
      moderate: [],
      minor: []
    };

    violations.forEach(v => {
      const severity = v.severity.toLowerCase();
      if (categorized[severity]) {
        categorized[severity].push(v);
      } else {
        // Default to moderate if severity is unknown
        categorized.moderate.push(v);
      }
    });

    return categorized;
  }

  async batchAnalyze(pagesData) {
    const results = [];
    
    // Process pages sequentially to avoid rate limits
    for (const pageData of pagesData) {
      const result = await this.analyzeContent(pageData);
      results.push({
        url: pageData.url,
        violations: result.violations || [],
        error: result.error
      });
      
      // Small delay to respect API rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return results;
  }
}

module.exports = LLMAnalyzer;
