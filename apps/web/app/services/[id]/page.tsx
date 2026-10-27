'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { StatusBadge, ErrorBox } from '@/components/ui';

export default function ServiceDetail({ params }: { params: { id: string } }) {
  const [svc, setSvc] = useState<any>(null);
  const [error, setError] = useState('');
  const [edit, setEdit] = useState({ name: '', healthCheckUrl: '', checkIntervalSec: 60, timeoutMs: 8000, failureThreshold: 3 });

  useEffect(() => {
    apiFetch<any>(`/api/v1/services/${params.id}`).then((s: any) => { setSvc(s); setEdit({ name: s.name, healthCheckUrl: s.healthCheckUrl ?? '', checkIntervalSec: s.checkIntervalSec, timeoutMs: s.timeoutMs, failureThreshold: s.failureThreshold }); }).catch((e) => setError((e as Error).message));
  }, [params.id]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try { const s = await apiFetch<any>(`/api/v1/services/${params.id}`, { method: 'PATCH', body: JSON.stringify(edit) }); setSvc({ ...svc, ...(s as object) }); }
    catch (err: any) { setError(err.message); }
  };

  if (error) return <ErrorBox message={error} />;
  if (!svc) return <p>Loading…</p>;
  return (
    <div>
      <h1>{svc.name} <StatusBadge value={svc.status} /></h1>
      <div className="grid two">
        <div className="card">
          <h3>Configuration</h3>
          <form onSubmit={save} style={{ display: 'grid', gap: 10 }}>
            <label>Name<input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
            <label>Health-check URL<input className="input" value={edit.healthCheckUrl} onChange={(e) => setEdit({ ...edit, healthCheckUrl: e.target.value })} /></label>
            <label>Interval (sec)<input className="input" type="number" value={edit.checkIntervalSec} onChange={(e) => setEdit({ ...edit, checkIntervalSec: +e.target.value })} /></label>
            <label>Timeout (ms)<input className="input" type="number" value={edit.timeoutMs} onChange={(e) => setEdit({ ...edit, timeoutMs: +e.target.value })} /></label>
            <label>Failure threshold<input className="input" type="number" value={edit.failureThreshold} onChange={(e) => setEdit({ ...edit, failureThreshold: +e.target.value })} /></label>
            <button className="btn primary">Save</button>
          </form>
        </div>
        <div className="card">
          <h3>Recent checks</h3>
          {svc.recentChecks?.map((c: any) => (<p key={c.id} style={{ fontSize: 13 }}>{c.ok ? '✅' : '❌'} {new Date(c.checkedAt).toLocaleString()} — {c.latencyMs}ms {c.statusCode ? `(HTTP ${c.statusCode})` : ''} {c.error}</p>))}
          <h3>Open incidents</h3>
          {svc.openIncidents?.map((i: any) => (<p key={i.id}><a href={`/incidents/${i.id}`}>{i.title}</a></p>)) || <p>None</p>}
        </div>
      </div>
    </div>
  );
}
