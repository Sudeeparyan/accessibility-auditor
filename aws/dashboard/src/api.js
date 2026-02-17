/**
 * api.js — HTTP client for the AWS API Gateway backend
 *
 * In dev mode (Vite), API calls go through the dev proxy.
 * In production (S3 static hosting), calls go directly to API Gateway.
 */

const API_BASE = import.meta.env.VITE_API_URL || '';

/** Check if the AWS backend is running and get its status */
export async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error('Server not responding');
    return await res.json();
  } catch (error) {
    throw new Error('Cannot connect to AWS backend');
  }
}

export async function runAudit(url, skipLLM = false) {
  const res = await fetch(`${API_BASE}/api/audit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, skipLLM }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Audit request failed' }));
    throw new Error(err.message || err.error || 'Audit failed');
  }

  const data = await res.json();

  // AWS returns { jobId, statusUrl } for async processing
  // Poll for results if we get a jobId back
  const auditId = data.jobId || data.auditId;
  if (auditId && !data.results && !data.summary?.overallScore) {
    return await pollForResults(auditId);
  }

  return data;
}

/** Poll the AWS backend until audit is COMPLETED or FAILED */
async function pollForResults(auditId) {
  const maxAttempts = 60; // 60 * 3s = 3 minutes max
  const pollInterval = 3000; // 3 seconds

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));

    const res = await fetch(`${API_BASE}/api/audit/${auditId}`);
    if (!res.ok) continue;

    const data = await res.json();

    // Check multiple ways the status can be indicated:
    // 1. Top-level status field
    // 2. summary.status field (pending record)
    // 3. If results/summary.overallScore exists, it's complete
    const status = data.status || data.summary?.status;

    if (status === 'FAILED' || data.error) {
      throw new Error(data.error || 'Audit failed on server');
    }

    // Audit is complete when it has actual results data
    if (data.results && data.summary?.overallScore !== undefined) {
      return data;
    }

    if (status === 'COMPLETED') {
      return data;
    }

    // PENDING or PROCESSING — keep polling
  }

  throw new Error('Audit timed out — please try again');
}

export async function runBatchAudit(urls, skipLLM = false) {
  const res = await fetch(`${API_BASE}/api/audit/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls, skipLLM }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Batch audit failed' }));
    throw new Error(err.message || err.error || 'Batch audit failed');
  }

  return await res.json();
}

export async function getHistory() {
  try {
    const res = await fetch(`${API_BASE}/api/audit/history`);
    if (!res.ok) return { history: [] };
    return await res.json();
  } catch {
    return { history: [] };
  }
}

export async function getApiInfo() {
  const res = await fetch(`${API_BASE}/api/info`);
  return await res.json();
}
