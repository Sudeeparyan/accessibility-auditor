const OpenAI = require('openai');

class LLMAnalyzer {
  constructor(apiKey) {
    this.enabled = !!apiKey;
    if (this.enabled) {
      this.openai = new OpenAI({ apiKey });
    } else {
      console.warn('LLMAnalyzer: No API key, semantic analysis disabled.');
    }
  }

  async analyzeContent(pageData) {
    if (!this.enabled) {
      return { violations: [], skipped: true, reason: 'No API key configured' };
    }

    try {
      console.log('Sending to GPT-4o for semantic analysis...');

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: this._buildPrompt(pageData) },
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0].message.content);
      console.log(`GPT-4o found ${result.violations?.length || 0} semantic violations`);
      return result;
    } catch (error) {
      console.error('LLM analysis failed:', error.message);
      return { violations: [], error: error.message };
    }
  }

  _buildPrompt(pageData) {
    const { content } = pageData;
    const maxTextLen = 2000;

    return `
Analyze this webpage for accessibility issues:

**PAGE TITLE**: ${content.title}

**HEADING STRUCTURE**:
${content.headings.slice(0, 15).map(h => `${h.level}: ${h.text}`).join('\n')}

**LINKS** (first 20):
${content.links.slice(0, 20).map(l =>
  l.ariaLabel
    ? `"${l.text}" (aria-label: "${l.ariaLabel}") -> ${l.href}`
    : `"${l.text}" -> ${l.href}`
).join('\n')}

**IMAGES** (first 10):
${content.images.slice(0, 10).map((img, i) =>
  `${i + 1}. ${img.hasAlt ? `alt="${img.alt}"` : 'NO ALT TEXT'} | src=${img.src.substring(0, 50)}`
).join('\n')}

**FORM FIELDS**:
${content.forms.map((form, i) => `
Form ${i + 1}: ${form.action}
${form.inputs.map(input => {
  const label = input.hasLabel ? 'has label' : (input.ariaLabel ? `aria-label="${input.ariaLabel}"` : 'NO LABEL');
  return `  - ${input.type} (${input.name || input.id || 'unnamed'}) ${label}`;
}).join('\n')}`).join('\n')}

**BUTTONS**:
${content.buttons.slice(0, 10).map(b =>
  `"${b.ariaLabel ? `aria-label="${b.ariaLabel}"` : b.text || 'NO TEXT'}" (${b.type})`
).join('\n')}

**PAGE TEXT** (first ${maxTextLen} chars):
${content.text.substring(0, maxTextLen)}

---
Find accessibility violations that axe-core cannot detect.`.trim();
  }
}

const SYSTEM_PROMPT = `You are an expert WCAG 2.1 accessibility auditor. Analyze web content for accessibility issues that automated tools cannot detect.

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

Severity levels: critical, serious, moderate, minor`;

module.exports = LLMAnalyzer;
