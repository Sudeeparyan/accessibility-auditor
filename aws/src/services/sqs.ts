/**
 * sqs.ts — SQS integration for asynchronous audit job processing
 *
 * In the serverless architecture, audits are processed asynchronously:
 *   1. API Gateway receives a POST /audit request
 *   2. Lambda pushes a message to SQS with the URL + options
 *   3. A separate Lambda consumer picks up the message,
 *      runs the audit pipeline, and stores results in DynamoDB
 *
 * This decoupling allows:
 *   - High-volume concurrent requests without Lambda timeout issues
 *   - Automatic retry on failures (SQS dead-letter queue)
 *   - Smooth scaling under load (SQS buffers bursts)
 *
 * Environment variables:
 *   SQS_QUEUE_URL     — The SQS queue URL for audit jobs
 *   SQS_DLQ_URL       — Dead-letter queue URL for failed jobs
 *   AWS_REGION        — AWS region (default: us-east-1)
 *   IS_OFFLINE        — 'true' to use in-memory queue fallback
 */

import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  GetQueueAttributesCommand,
} from '@aws-sdk/client-sqs';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AuditJobMessage {
  jobId: string;
  url: string;
  options: {
    skipLLM?: boolean;
    priority?: 'high' | 'normal' | 'low';
    callbackUrl?: string; // Webhook to notify on completion
  };
  submittedAt: string;
  retryCount?: number;
}

export interface BatchAuditJobMessage {
  batchId: string;
  urls: string[];
  options: {
    skipLLM?: boolean;
  };
  submittedAt: string;
}

export interface QueueStats {
  approximateMessages: number;
  approximateMessagesNotVisible: number;
  approximateMessagesDelayed: number;
}

// ─── Configuration ───────────────────────────────────────────────────────────

const QUEUE_URL = process.env.SQS_QUEUE_URL || '';
const DLQ_URL = process.env.SQS_DLQ_URL || '';
const REGION = process.env.AWS_REGION || 'us-east-1';
const IS_OFFLINE = process.env.IS_OFFLINE === 'true';

// ─── SQS Client ──────────────────────────────────────────────────────────────

let sqsClient: SQSClient | null = null;

function getClient(): SQSClient {
  if (sqsClient) return sqsClient;
  sqsClient = new SQSClient({ region: REGION });
  return sqsClient;
}

// ─── In-Memory Queue Fallback (local dev) ────────────────────────────────────

const memoryQueue: AuditJobMessage[] = [];

// ─── Producer: Enqueue audit jobs ────────────────────────────────────────────

/**
 * Send a single audit job to the SQS queue
 *
 * @param job — Audit job message (URL, options, etc.)
 * @returns MessageId from SQS (or a local UUID in offline mode)
 */
export async function enqueueAuditJob(
  job: AuditJobMessage
): Promise<string> {
  if (IS_OFFLINE || !QUEUE_URL) {
    // Local fallback: push to in-memory queue
    memoryQueue.push(job);
    console.log(`[SQS-Local] Enqueued job ${job.jobId} (queue size: ${memoryQueue.length})`);
    return job.jobId;
  }

  const client = getClient();
  const result = await client.send(
    new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify(job),
      MessageAttributes: {
        jobId: { DataType: 'String', StringValue: job.jobId },
        priority: {
          DataType: 'String',
          StringValue: job.options.priority || 'normal',
        },
      },
      // High-priority jobs skip the delay; normal jobs get 0 delay
      DelaySeconds: job.options.priority === 'low' ? 30 : 0,
    })
  );

  console.log(`[SQS] Enqueued job ${job.jobId} → MessageId: ${result.MessageId}`);
  return result.MessageId || job.jobId;
}

/**
 * Enqueue multiple URLs as individual SQS messages (fan-out pattern)
 *
 * @param batch — Batch job with multiple URLs
 * @returns Array of MessageIds
 */
export async function enqueueBatchAuditJobs(
  batch: BatchAuditJobMessage
): Promise<string[]> {
  const messageIds: string[] = [];

  for (let i = 0; i < batch.urls.length; i++) {
    const job: AuditJobMessage = {
      jobId: `${batch.batchId}-${i}`,
      url: batch.urls[i],
      options: batch.options,
      submittedAt: batch.submittedAt,
    };

    const messageId = await enqueueAuditJob(job);
    messageIds.push(messageId);
  }

  console.log(`[SQS] Batch ${batch.batchId}: enqueued ${messageIds.length} jobs`);
  return messageIds;
}

// ─── Consumer: Dequeue audit jobs (for local dev & testing) ──────────────────

/**
 * Receive messages from the SQS queue (used by Lambda consumer or local poller)
 *
 * @param maxMessages — Maximum number of messages to receive (1–10)
 * @returns Array of audit job messages with receipt handles
 */
export async function receiveAuditJobs(
  maxMessages: number = 1
): Promise<Array<{ job: AuditJobMessage; receiptHandle: string }>> {
  if (IS_OFFLINE || !QUEUE_URL) {
    // Local fallback: dequeue from memory
    const jobs = memoryQueue.splice(0, maxMessages).map((job) => ({
      job,
      receiptHandle: job.jobId,
    }));
    return jobs;
  }

  const client = getClient();
  const result = await client.send(
    new ReceiveMessageCommand({
      QueueUrl: QUEUE_URL,
      MaxNumberOfMessages: maxMessages,
      WaitTimeSeconds: 5, // Long polling
      VisibilityTimeout: 300, // 5-minute processing window
    })
  );

  if (!result.Messages) return [];

  return result.Messages.map((msg) => ({
    job: JSON.parse(msg.Body || '{}') as AuditJobMessage,
    receiptHandle: msg.ReceiptHandle || '',
  }));
}

/**
 * Delete a processed message from the queue (acknowledge completion)
 */
export async function acknowledgeJob(receiptHandle: string): Promise<void> {
  if (IS_OFFLINE || !QUEUE_URL) return;

  const client = getClient();
  await client.send(
    new DeleteMessageCommand({
      QueueUrl: QUEUE_URL,
      ReceiptHandle: receiptHandle,
    })
  );
}

// ─── Queue Monitoring ────────────────────────────────────────────────────────

/**
 * Get approximate queue depth stats (for monitoring / dashboard)
 */
export async function getQueueStats(): Promise<QueueStats> {
  if (IS_OFFLINE || !QUEUE_URL) {
    return {
      approximateMessages: memoryQueue.length,
      approximateMessagesNotVisible: 0,
      approximateMessagesDelayed: 0,
    };
  }

  const client = getClient();
  const result = await client.send(
    new GetQueueAttributesCommand({
      QueueUrl: QUEUE_URL,
      AttributeNames: [
        'ApproximateNumberOfMessages',
        'ApproximateNumberOfMessagesNotVisible',
        'ApproximateNumberOfMessagesDelayed',
      ],
    })
  );

  const attrs = result.Attributes || {};
  return {
    approximateMessages: parseInt(attrs.ApproximateNumberOfMessages || '0', 10),
    approximateMessagesNotVisible: parseInt(
      attrs.ApproximateNumberOfMessagesNotVisible || '0',
      10
    ),
    approximateMessagesDelayed: parseInt(
      attrs.ApproximateNumberOfMessagesDelayed || '0',
      10
    ),
  };
}

export default {
  enqueueAuditJob,
  enqueueBatchAuditJobs,
  receiveAuditJobs,
  acknowledgeJob,
  getQueueStats,
};
