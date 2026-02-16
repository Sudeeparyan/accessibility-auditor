# AccessibilityAI Auditor — Local Development

Standalone local server for running WCAG 2.1 accessibility audits using an Express API, Puppeteer scraping, axe-core rules, and GPT-4o semantic analysis.

## Quick Start

```bash
# 1. Install dependencies
npm run install:all

# 2. (Optional) Add your OpenAI API key
cp .env.example .env
# Edit .env → OPENAI_API_KEY=sk-your-key-here

# 3. Start the API server
npm start
# Server runs at http://localhost:3001

# 4. Start the React dashboard (separate terminal)
npm run dashboard
# Dashboard runs at http://localhost:5173
```

## Architecture

```
URL Input → Express API (port 3001)
              → Puppeteer (headless browser)
                → axe-core (50+ WCAG rules)
                → GPT-4o (semantic analysis)
              → Combined Report → Dashboard (React)
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start Express API server |
| `npm run dev` | Start with auto-reload (nodemon) |
| `npm run dashboard` | Start React dashboard |
| `npm test` | Run manual smoke tests |
| `npm run install:all` | Install all dependencies |

## Folder Structure

```
local/
├── src/
│   ├── api/server.js              # Express REST API
│   ├── analyzer/
│   │   ├── combiner.js            # Merges axe-core + LLM results
│   │   └── llm-analyzer.js        # GPT-4o semantic analysis
│   ├── orchestrator/job-manager.js # Pipeline orchestrator
│   └── scraper/puppeteer-scraper.js # Puppeteer + axe-core scraper
├── dashboard/                      # React frontend (Vite)
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api.js
│   │   └── components/
│   └── package.json
├── test/manual-test.js            # Smoke tests
└── package.json
```
