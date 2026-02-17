/**
 * api-handler.ts — AWS Lambda handler for API Gateway integration
 *
 * This is the serverless entry point that replaces Express.js in production.
 * API Gateway routes HTTP requests to this Lambda function, which processes
 * them and returns responses in API Gateway proxy format.
 *
 * Routes:
 *   GET  /health            → Health check
 *   GET  /api/info          → API metadata
 *   POST /api/audit         → Enqueue single audit job (async via SQS)
 *   POST /api/audit/sync    → Run audit synchronously (for small jobs)
 *   POST /api/audit/batch   → Enqueue batch audit jobs
 *   GET  /api/audit/:id     → Get audit result by ID (from DynamoDB)
 *   GET  /api/audit/history → Recent audit history (from DynamoDB)
 */

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from 'aws-lambda';
import { enqueueAuditJob, enqueueBatchAuditJobs, getQueueStats } from '../services/sqs';
import { getAuditReport, getRecentAudits, saveAuditReport, AuditRecord } from '../services/dynamodb';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuditRequest {
  url: string;
  skipLLM?: boolean;
}

interface BatchAuditRequest {
  urls: string[];
  skipLLM?: boolean;
}

// ─── Main Handler ────────────────────────────────────────────────────────────

export async function handler(
  event: APIGatewayProxyEventV2,
  context: Context
): Promise<APIGatewayProxyResultV2> {
  // Don't wait for event loop to empty (faster cold starts)
  context.callbackWaitsForEmptyEventLoop = false;

  // API Gateway v2 (httpApi) uses requestContext.http for method/path
  const httpMethod = event.requestContext.http.method;
  const path = event.rawPath;
  const body = event.body || null;

  console.log(`[Lambda] ${httpMethod} ${path}`);

  try {
    // ── Route matching ──────────────────────────────────────────────

    // GET /health
    if (httpMethod === 'GET' && path === '/health') {
      return respond(200, {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        runtime: 'aws-lambda',
        llmEnabled: !!process.env.OPENAI_API_KEY,
        region: process.env.AWS_REGION || 'us-east-1',
      });
    }

    // GET /api/info
    if (httpMethod === 'GET' && path === '/api/info') {
      return respond(200, {
        name: 'AccessibilityAI Auditor API',
        version: '1.0.0',
        description: 'Serverless hybrid rule-based + LLM accessibility auditing platform',
        architecture: 'AWS Lambda + API Gateway + SQS + DynamoDB',
        endpoints: {
          '/health': 'Health check',
          '/api/info': 'API information',
          '/api/audit': 'POST — Submit audit job (async)',
          '/api/audit/sync': 'POST — Run audit synchronously',
          '/api/audit/batch': 'POST — Submit batch audit jobs',
          '/api/audit/:id': 'GET — Get audit result',
          '/api/audit/history': 'GET — Recent audit history',
          '/api/queue/stats': 'GET — SQS queue statistics',
        },
      });
    }

    // POST /api/audit — Async (enqueue to SQS)
    if (httpMethod === 'POST' && path === '/api/audit') {
      const { url, skipLLM } = parseBody<AuditRequest>(body);

      if (!url) {
        return respond(400, { error: 'URL is required', example: { url: 'https://example.com' } });
      }

      try {
        new URL(url);
      } catch {
        return respond(400, { error: 'Invalid URL format', provided: url });
      }

      const jobId = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // Create a "pending" record in DynamoDB so polling returns status immediately
      const pendingRecord: AuditRecord = {
        auditId: jobId,
        url,
        scannedAt: new Date().toISOString(),
        duration: 0,
        score: 0,
        complianceLevel: 'pending',
        totalIssues: 0,
        criticalIssues: 0,
        results: {},
        summary: { status: 'pending' },
        metadata: { submittedAt: new Date().toISOString() },
      };
      await saveAuditReport(pendingRecord);

      await enqueueAuditJob({
        jobId,
        url,
        options: { skipLLM },
        submittedAt: new Date().toISOString(),
      });

      return respond(202, {
        success: true,
        message: 'Audit job submitted',
        jobId,
        statusUrl: `/api/audit/${jobId}`,
      });
    }

    // POST /api/audit/batch — Async batch (fan-out via SQS)
    if (httpMethod === 'POST' && path === '/api/audit/batch') {
      const { urls, skipLLM } = parseBody<BatchAuditRequest>(body);

      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return respond(400, { error: 'URLs array is required' });
      }
      if (urls.length > 10) {
        return respond(400, { error: 'Batch limited to 10 URLs', provided: urls.length });
      }

      const batchId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const messageIds = await enqueueBatchAuditJobs({
        batchId,
        urls,
        options: { skipLLM },
        submittedAt: new Date().toISOString(),
      });

      return respond(202, {
        success: true,
        message: `${urls.length} audit jobs submitted`,
        batchId,
        jobIds: messageIds,
      });
    }

    // GET /api/audit/history
    if (httpMethod === 'GET' && path === '/api/audit/history') {
      const limit = parseInt(event.queryStringParameters?.limit || '50', 10);
      const history = await getRecentAudits(limit);

      return respond(200, {
        success: true,
        count: history.length,
        history,
      });
    }

    // GET /api/audit/:id — Get specific audit result
    if (httpMethod === 'GET' && path.startsWith('/api/audit/')) {
      const auditId = path.split('/').pop() || '';

      if (!auditId || auditId === 'history') {
        return respond(400, { error: 'Audit ID is required' });
      }

      const report = await getAuditReport(auditId);

      if (!report) {
        return respond(404, {
          error: 'Audit not found',
          message: 'The audit may still be processing. Try again in a few seconds.',
          auditId,
        });
      }

      // Determine status based on the record contents
      const isPending = !report.results || Object.keys(report.results).length === 0
        || report.complianceLevel === 'pending';
      const status = isPending ? 'PENDING' : 'COMPLETED';

      return respond(200, { success: true, status, ...report });
    }

    // GET /api/queue/stats — SQS queue statistics
    if (httpMethod === 'GET' && path === '/api/queue/stats') {
      const stats = await getQueueStats();
      return respond(200, { success: true, queue: stats });
    }

    // ── 404 ─────────────────────────────────────────────────────────
    return respond(404, { error: 'Endpoint not found', path });

  } catch (error: any) {
    console.error('[Lambda] Unhandled error:', error);
    return respond(500, {
      error: 'Internal server error',
      message: error.message,
    });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function respond(statusCode: number, body: Record<string, any>): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

function parseBody<T>(body: string | null): T {
  if (!body) return {} as T;
  try {
    return JSON.parse(body) as T;
  } catch {
    return {} as T;
  }
}
