# AccessibilityAI Auditor — AWS Serverless

Fully serverless WCAG 2.1 accessibility auditing platform deployed on AWS using the Serverless Framework.

## Architecture

```
Client → API Gateway → Lambda (api-handler)
                           ↓
                        SQS Queue → Lambda (audit-consumer)
                                       ↓
                                    Puppeteer + axe-core + GPT-4o
                                       ↓
                                    DynamoDB (results storage)
```

## AWS Services Used

- **API Gateway** — HTTP REST API with CORS
- **Lambda** — api-handler (API routes) + audit-consumer (SQS processor)
- **SQS** — Audit job queue with dead-letter queue for retries
- **DynamoDB** — Audit results storage with TTL & GSI
- **Chrome Lambda Layer** — Headless Chromium for Puppeteer in Lambda

## Deploy

```bash
# 1. Install dependencies
npm install

# 2. Set your OpenAI API key
export OPENAI_API_KEY=sk-your-key-here

# 3. Deploy to AWS (dev stage)
npm run deploy

# 4. Deploy to production
npm run deploy:prod

# 5. Remove stack
npm run remove
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run deploy` | Deploy to AWS (dev stage) |
| `npm run deploy:prod` | Deploy to AWS (prod stage) |
| `npm run remove` | Remove the CloudFormation stack |
| `npm run offline` | Run locally with serverless-offline |
| `npm run build` | TypeScript type checking |
| `npm run logs:api` | Tail API Lambda logs |
| `npm run logs:consumer` | Tail consumer Lambda logs |

## Folder Structure

```
aws/
├── src/
│   ├── handlers/
│   │   ├── api-handler.ts        # API Gateway Lambda handler
│   │   └── audit-consumer.ts     # SQS consumer Lambda handler
│   ├── services/
│   │   ├── dynamodb.ts           # DynamoDB persistence layer
│   │   └── sqs.ts                # SQS message producer/consumer
│   ├── types/index.ts            # TypeScript type definitions
│   ├── analyzer/
│   │   ├── combiner.js           # Merges axe-core + LLM results
│   │   └── llm-analyzer.js       # GPT-4o semantic analysis
│   ├── orchestrator/job-manager.js # Pipeline orchestrator
│   └── scraper/puppeteer-scraper.js # Puppeteer + axe-core scraper
├── serverless.yml                 # Serverless Framework config
├── webpack.config.js              # Webpack for Lambda bundling
├── tsconfig.json                  # TypeScript config
└── package.json
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key for GPT-4o semantic analysis |
| `DYNAMODB_TABLE` | Auto-set by Serverless Framework |
| `SQS_QUEUE_URL` | Auto-set by Serverless Framework |
| `SQS_DLQ_URL` | Auto-set by Serverless Framework |
