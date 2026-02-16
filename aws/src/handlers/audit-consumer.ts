/**
 * audit-consumer.ts — SQS consumer Lambda that processes audit jobs
 *
 * This Lambda is triggered by SQS messages. Each message contains a URL
 * to audit. The handler:
 *   1. Receives the SQS event with audit job details
 *   2. Launches Puppeteer (via chrome-aws-lambda in production)
 *   3. Runs the axe-core + GPT-4o hybrid analysis pipeline
 *   4. Stores the completed report in DynamoDB
 *   5. Optionally sends a webhook callback
 *
 * SQS automatically handles:
 *   - Retry on failure (up to 3 times, then moves to DLQ)
 *   - Concurrent scaling (up to 5 Lambda instances per queue)
 *   - Visibility timeout to prevent duplicate processing
 */

import { SQSEvent, SQSRecord, Context } from 'aws-lambda';
import { saveAuditReport, AuditRecord } from '../services/dynamodb';

// Import the JS modules (they stay as CommonJS)
const JobManager = require('../orchestrator/job-manager');

// ─── Configuration ───────────────────────────────────────────────────────────

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ─── Handler ─────────────────────────────────────────────────────────────────

/**
 * Process SQS audit job messages
 *
 * Each SQS record contains a JSON-encoded AuditJobMessage.
 * Failed records are automatically retried by SQS (up to maxReceiveCount).
 */
export async function handler(
  event: SQSEvent,
  context: Context
): Promise<{ batchItemFailures: Array<{ itemIdentifier: string }> }> {
  context.callbackWaitsForEmptyEventLoop = false;

  console.log(`[AuditConsumer] Processing ${event.Records.length} message(s)`);

  const failures: Array<{ itemIdentifier: string }> = [];
  let jobManager: any = null;

  try {
    // Initialize Puppeteer + JobManager once per invocation
    jobManager = new JobManager(OPENAI_API_KEY);
    await jobManager.initialize();

    for (const record of event.Records) {
      try {
        await processRecord(record, jobManager);
      } catch (error: any) {
        console.error(`[AuditConsumer] Failed to process message ${record.messageId}:`, error.message);
        // Report individual message failure for partial batch retry
        failures.push({ itemIdentifier: record.messageId });
      }
    }
  } catch (initError: any) {
    console.error('[AuditConsumer] Initialization failed:', initError.message);
    // All messages fail if we can't initialize
    return {
      batchItemFailures: event.Records.map((r) => ({ itemIdentifier: r.messageId })),
    };
  } finally {
    // Always close the browser to free Lambda memory
    if (jobManager) {
      try {
        await jobManager.close();
      } catch (e) {
        console.warn('[AuditConsumer] Error closing job manager:', e);
      }
    }
  }

  console.log(
    `[AuditConsumer] Completed: ${event.Records.length - failures.length} succeeded, ${failures.length} failed`
  );

  // Return partial batch failure response (SQS will retry only failed messages)
  return { batchItemFailures: failures };
}

// ─── Process Individual Record ───────────────────────────────────────────────

async function processRecord(record: SQSRecord, jobManager: any): Promise<void> {
  const job = JSON.parse(record.body) as {
    jobId: string;
    url: string;
    options: { skipLLM?: boolean; callbackUrl?: string };
    submittedAt: string;
    retryCount?: number;
  };

  console.log(`[AuditConsumer] Processing job ${job.jobId}: ${job.url}`);

  const startTime = Date.now();

  // Run the full audit pipeline
  const results = await jobManager.auditWebsite(job.url, {
    skipLLM: job.options.skipLLM,
  });

  const duration = (Date.now() - startTime) / 1000;

  // Build the DynamoDB record
  const auditRecord: AuditRecord = {
    auditId: job.jobId,
    url: job.url,
    scannedAt: results.scannedAt,
    duration,
    score: results.summary.overallScore,
    complianceLevel: results.summary.complianceLevel,
    totalIssues: results.summary.totalIssues,
    criticalIssues: results.summary.criticalIssues,
    results: results.results,
    summary: results.summary,
    metadata: results.metadata,
  };

  // Persist to DynamoDB
  await saveAuditReport(auditRecord);

  console.log(
    `[AuditConsumer] Job ${job.jobId} complete: score=${auditRecord.score}, issues=${auditRecord.totalIssues}`
  );

  // Optional: Send webhook callback
  if (job.options.callbackUrl) {
    try {
      await sendWebhook(job.options.callbackUrl, auditRecord);
    } catch (err: any) {
      console.warn(`[AuditConsumer] Webhook failed for ${job.jobId}:`, err.message);
      // Don't fail the job if webhook fails
    }
  }
}

// ─── Webhook Notification ────────────────────────────────────────────────────

async function sendWebhook(url: string, data: AuditRecord): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'audit.completed',
      auditId: data.auditId,
      url: data.url,
      score: data.score,
      complianceLevel: data.complianceLevel,
      totalIssues: data.totalIssues,
      timestamp: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Webhook returned ${response.status}`);
  }
}
