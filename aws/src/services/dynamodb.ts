/**
 * dynamodb.ts — DynamoDB persistence layer for audit results
 *
 * Provides CRUD operations for storing and retrieving accessibility audit
 * reports in AWS DynamoDB. Falls back to in-memory storage when running
 * locally without AWS credentials.
 *
 * Table schema:
 *   PK: auditId (string)  — Unique audit identifier (UUID / timestamp-based)
 *   SK: url (string)      — The audited URL
 *   GSI: url-index        — Query all audits for a specific URL
 *
 * Environment variables:
 *   DYNAMODB_TABLE   — Table name (default: accessibility-audits)
 *   AWS_REGION       — AWS region (default: us-east-1)
 *   IS_OFFLINE       — Set to 'true' to use in-memory fallback
 */

import {
  DynamoDBClient,
  DynamoDBClientConfig,
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  ScanCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AuditRecord {
  auditId: string;
  url: string;
  scannedAt: string;
  duration: number;
  score: number;
  complianceLevel: string;
  totalIssues: number;
  criticalIssues: number;
  results: Record<string, any>;
  summary: Record<string, any>;
  metadata: Record<string, any>;
  ttl?: number; // Auto-expire old records (epoch seconds)
}

export interface AuditHistoryItem {
  auditId: string;
  url: string;
  scannedAt: string;
  duration: number;
  score: number;
  complianceLevel: string;
  totalIssues: number;
  criticalIssues: number;
}

// ─── Configuration ───────────────────────────────────────────────────────────

const TABLE_NAME = process.env.DYNAMODB_TABLE || 'accessibility-audits';
const REGION = process.env.AWS_REGION || 'us-east-1';
const IS_OFFLINE = process.env.IS_OFFLINE === 'true';
const RECORD_TTL_DAYS = 90; // Auto-expire after 90 days

// ─── DynamoDB Client Setup ───────────────────────────────────────────────────

let docClient: DynamoDBDocumentClient | null = null;

function getClient(): DynamoDBDocumentClient {
  if (docClient) return docClient;

  const config: DynamoDBClientConfig = { region: REGION };

  // Local development with DynamoDB Local
  if (IS_OFFLINE) {
    config.endpoint = 'http://localhost:8000';
    config.credentials = {
      accessKeyId: 'local',
      secretAccessKey: 'local',
    };
  }

  const client = new DynamoDBClient(config);
  docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: {
      removeUndefinedValues: true,
      convertClassInstanceToMap: true,
    },
  });

  return docClient;
}

// ─── In-Memory Fallback (for local dev without DynamoDB) ─────────────────────

const memoryStore: Map<string, AuditRecord> = new Map();

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Save a completed audit report to DynamoDB
 */
export async function saveAuditReport(report: AuditRecord): Promise<void> {
  // Add TTL for automatic cleanup
  report.ttl = Math.floor(Date.now() / 1000) + RECORD_TTL_DAYS * 86400;

  if (IS_OFFLINE && !process.env.DYNAMODB_TABLE) {
    // In-memory fallback
    memoryStore.set(report.auditId, report);
    console.log(`[DynamoDB-Local] Saved audit ${report.auditId}`);
    return;
  }

  const client = getClient();
  await client.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: report,
    })
  );
  console.log(`[DynamoDB] Saved audit ${report.auditId}`);
}

/**
 * Retrieve a specific audit report by ID
 */
export async function getAuditReport(
  auditId: string
): Promise<AuditRecord | null> {
  if (IS_OFFLINE && !process.env.DYNAMODB_TABLE) {
    return memoryStore.get(auditId) || null;
  }

  const client = getClient();
  const result = await client.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { auditId },
    })
  );

  return (result.Item as AuditRecord) || null;
}

/**
 * Query all audits for a specific URL (via GSI)
 */
export async function getAuditsByUrl(
  url: string,
  limit: number = 20
): Promise<AuditHistoryItem[]> {
  if (IS_OFFLINE && !process.env.DYNAMODB_TABLE) {
    return Array.from(memoryStore.values())
      .filter((r) => r.url === url)
      .sort((a, b) => b.scannedAt.localeCompare(a.scannedAt))
      .slice(0, limit)
      .map(toHistoryItem);
  }

  const client = getClient();
  const result = await client.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'url-index',
      KeyConditionExpression: '#url = :url',
      ExpressionAttributeNames: { '#url': 'url' },
      ExpressionAttributeValues: { ':url': url },
      Limit: limit,
      ScanIndexForward: false, // Newest first
    })
  );

  return (result.Items || []).map((item) => toHistoryItem(item as AuditRecord));
}

/**
 * Get recent audit history (latest N audits across all URLs)
 */
export async function getRecentAudits(
  limit: number = 50
): Promise<AuditHistoryItem[]> {
  if (IS_OFFLINE && !process.env.DYNAMODB_TABLE) {
    return Array.from(memoryStore.values())
      .sort((a, b) => b.scannedAt.localeCompare(a.scannedAt))
      .slice(0, limit)
      .map(toHistoryItem);
  }

  const client = getClient();
  const result = await client.send(
    new ScanCommand({
      TableName: TABLE_NAME,
      Limit: limit,
      ProjectionExpression:
        'auditId, #url, scannedAt, #dur, score, complianceLevel, totalIssues, criticalIssues',
      ExpressionAttributeNames: { '#url': 'url', '#dur': 'duration' },
    })
  );

  return (result.Items || [])
    .map((item) => toHistoryItem(item as AuditRecord))
    .sort((a, b) => b.scannedAt.localeCompare(a.scannedAt));
}

/**
 * Delete an audit report by ID
 */
export async function deleteAuditReport(auditId: string): Promise<void> {
  if (IS_OFFLINE && !process.env.DYNAMODB_TABLE) {
    memoryStore.delete(auditId);
    return;
  }

  const client = getClient();
  await client.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { auditId },
    })
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toHistoryItem(record: AuditRecord): AuditHistoryItem {
  return {
    auditId: record.auditId,
    url: record.url,
    scannedAt: record.scannedAt,
    duration: record.duration,
    score: record.score,
    complianceLevel: record.complianceLevel,
    totalIssues: record.totalIssues,
    criticalIssues: record.criticalIssues,
  };
}

export default {
  saveAuditReport,
  getAuditReport,
  getAuditsByUrl,
  getRecentAudits,
  deleteAuditReport,
};
