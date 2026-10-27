'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { ErrorBox } from '@/components/ui';

function safe(text: string) { return text; } // React escapes by default; render as text, never dangerouslySetInnerHTML.

export default function LogsPage() {
  const { orgId } = useAuth();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [f, setF] = useState({ severity: '', search: '', environment: '' });
  const [keys, setKeys] = useState<any[]>([]);
  const [keyName, setKeyName] = useState('ci-pipeline');
  const [newKey, setNewKey] = useState('');

  const load = () => orgId && apiFetch(`/api/v1/logs?${new URLSearchParams(Object.fromEntries(Object.entries(f).filter(([, v]) => v)))}`).then(setData).catch((e) => setError(e.message));
  const loadKeys = () => orgId && apiFetch<any[]>('/api/v1/api-keys').then(setKeys).catch(() => undefined);
  useEffect(() => { load(); loadKeys(); }, [orgId]);

  const createKey = async (e: React.FormEvent) => {
    e.preventDefault();
    try { const k = await apiFetch<any>('/api/v1/api-keys', { method: 'POST', body: JSON.stringify({ name: keyName }) }); setNewKey(k.apiKey); loadKeys(); }
    catch (err: any) { setError(err.message); }
  };

  return (
    <div>
      <h1>Logs & events</h1>
      {error && <ErrorBox message={error} />}
      <div className="card">
        <h3>Ingestion API keys</h3>
        <form onSubmit={createKey} style={{ display: 'flex', gap: 8 }}>
          <input className="input" value={keyName} onChange={(e) => setKeyName(e.target.value)} aria-label="Key name" required />
          <button className="btn">Create key</button>
        </form>
        {newKey && <div className="alert ok">New key (shown once): <code className="mono">{newKey}</code><br />Send logs: <code className="mono">POST /api/v1/ingest/events</code> with header <code className="mono">X-API-Key</code>.</div>}
        <ul>{keys.map((k) => (<li key={k.id} style={{ fontSize: 13 }}>{k.name} ({k.keyPrefix}…) {k.revokedAt ? 'revoked' : ''}</li>))}</ul>
      </div>
      <div className="toolbar">
        <select className="select" style={{ width: 160 }} value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })} aria-label="Severity"><option value="">All severities</option><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select>
        <input className="input" style={{ maxWidth: 220 }} placeholder="Environment" value={f.environment} onChange={(e) => setF({ ...f, environment: e.target.value })} aria-label="Environment" />
        <input className="input" style={{ maxWidth: 280 }} placeholder="Search message…" value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })} aria-label="Search" />
        <button className="btn primary" onClick={load}>Apply</button>
      </div>
      <div className="card">
        <table className="table"><thead><tr><th>Time</th><th>Severity</th><th>Service</th><th>Message</th></tr></thead>
          <tbody>{data?.items?.map((l: any) => (<tr key={l.id}><td className="mono">{new Date(l.timestamp).toLocaleString()}</td><td>{l.severity}</td><td>{l.service?.name ?? '—'}</td><td>{safe(l.message).slice(0, 160)}</td></tr>))}</tbody></table>
        {!data?.items?.length && <p style={{ color: 'var(--muted)' }}>No log events match. Ingest via the API key above.</p>}
      </div>
    </div>
  );
}
