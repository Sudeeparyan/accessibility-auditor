const API_BASE = '';

export async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error('Server not responding');
    return await res.json();
  } catch (error) {
    throw new Error('Cannot connect to backend server');
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

  return await res.json();
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
