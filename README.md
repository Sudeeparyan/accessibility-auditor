# AccessibilityAI Auditor

A scalable WCAG 2.1 compliance auditing platform combining rule-based analysis (axe-core) with AI-powered semantic analysis (GPT-4o). Reduces false positives by ~40% through a hybrid dual-layer pipeline.

## Project Structure

This project is split into two independent folders:

```
accessibility-auditor/
├── local/    # Local development — Express server + React dashboard
└── aws/      # AWS deployment — Lambda, API Gateway, SQS, DynamoDB
```

### `local/` — Local Development

Standalone Express server with React dashboard. No AWS dependencies. Uses in-memory storage for audit history.

```bash
cd local
npm run install:all
npm start          # API at http://localhost:3001
npm run dashboard  # Dashboard at http://localhost:5173
```

### `aws/` — AWS Serverless Deployment

Serverless Framework deployment to AWS with Lambda, API Gateway, SQS queues, and DynamoDB persistence.

```bash
cd aws
npm install
export OPENAI_API_KEY=sk-your-key-here
npm run deploy     # Deploys to AWS
```

## Tech Stack

- **Node.js / TypeScript** — Backend runtime
- **Puppeteer** — Headless browser for scraping JS-heavy pages
- **axe-core** — 50+ automated WCAG 2.1 rules
- **OpenAI GPT-4o** — Semantic accessibility analysis
- **AWS Lambda** — Serverless compute
- **API Gateway** — HTTP REST API
- **SQS** — Asynchronous job processing with dead-letter queue
- **DynamoDB** — Audit results storage
- **React + Vite** — Dashboard frontend
- **Serverless Framework** — Infrastructure as code

## Key Features

- **Hybrid Analysis**: Dual-layer pipeline combining axe-core static checks + GPT-4o semantic analysis
- **Distributed Scraping**: Fault-tolerant Puppeteer scraping with automatic retry logic and proxy rotation
- **Async Processing**: SQS-based job queue with DLQ for reliable audit processing
- **Compliance Scoring**: 0–100 score with WCAG Level A/AA/AAA coverage breakdown
