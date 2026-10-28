'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch, apiUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { StatusBadge, ErrorBox } from '@/components/ui';

export default function IncidentsPage() {
  const { orgId } = useAuth();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [title, setTitle] = useState('');

  const load = () => { if (!orgId) return; apiFetch<any>(`/api/v1/incidents${status ? `?status=${status}` : ''}`).then(setData).catch((e) => setError((e as Error).message)); };
  useEffect(() => { load(); }, [orgId, status]);

  // Realtime: refresh on SSE events
  useEffect(() => {
    if (!orgId) return;
    const es = new EventSource(apiUrl(`/api/v1/events/stream?orgId=${encodeURIComponent(orgId)}`), { withCredentials: true });
    es.addEventListener('incident.created', load);
    es.addEventListener('incident.updated', load);
    return () => es.close();
  }, [orgId]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await apiFetch('/api/v1/incidents', { method: 'POST', body: JSON.stringify({ title }) }); setTitle(''); load(); }
    catch (err: any) { setError(err.message); }
  };

  return (
    <div>
      <h1>Incidents</h1>
      {error && <ErrorBox message={error} />}
      <div className="toolbar">
        <select className="select" style={{ width: 200 }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option><option>OPEN</option><option>ACKNOWLEDGED</option><option>INVESTIGATING</option><option>RESOLVED</option><option>REOPENED</option>
        </select>
        <form onSubmit={create} style={{ display: 'flex', gap: 8 }}>
          <input className="input" placeholder="New incident title…" value={title} onChange={(e) => setTitle(e.target.value)} required aria-label="New incident title" />
          <button className="btn primary">Create</button>
        </form>
      </div>
      <div className="card">
        <table className="table"><thead><tr><th>Title</th><th>Status</th><th>Severity</th><th>Service</th><th>Created</th></tr></thead>
          <tbody>{data?.items?.map((i: any) => (<tr key={i.id}><td><Link href={`/incidents/${i.id}`}>{i.title}</Link></td><td><StatusBadge value={i.status} /></td><td><StatusBadge value={i.severity} /></td><td>{i.service?.name ?? '—'}</td><td>{new Date(i.createdAt).toLocaleString()}</td></tr>))}</tbody></table>
        {!data?.items?.length && <p style={{ color: 'var(--muted)' }}>No incidents match this filter.</p>}
      </div>
    </div>
  );
}
