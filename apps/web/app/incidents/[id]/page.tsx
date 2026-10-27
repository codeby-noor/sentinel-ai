'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { StatusBadge, ErrorBox } from '@/components/ui';

const NEXT_STATES: Record<string, string[]> = {
  OPEN: ['ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED'],
  ACKNOWLEDGED: ['INVESTIGATING', 'RESOLVED', 'OPEN'],
  INVESTIGATING: ['RESOLVED', 'ACKNOWLEDGED', 'OPEN'],
  RESOLVED: ['REOPENED'],
  REOPENED: ['ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED'],
};

export default function IncidentDetail({ params }: { params: { id: string } }) {
  const [inc, setInc] = useState<any>(null);
  const [error, setError] = useState('');
  const [comment, setComment] = useState('');
  const [ai, setAi] = useState<any>(null);
  const [aiBusy, setAiBusy] = useState(false);

  const load = () => { apiFetch<any>(`/api/v1/incidents/${params.id}`).then(setInc).catch((e) => setError((e as Error).message)); };
  useEffect(() => { load(); }, [params.id]);

  const transition = async (status: string) => {
    try { await apiFetch(`/api/v1/incidents/${params.id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }); load(); }
    catch (e: any) { setError(e.message); }
  };
  const sendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await apiFetch(`/api/v1/incidents/${params.id}/comments`, { method: 'POST', body: JSON.stringify({ body: comment }) }); setComment(''); load(); }
    catch (e: any) { setError(e.message); }
  };
  const investigate = async () => {
    setAiBusy(true); setAi(null);
    try { setAi(await apiFetch(`/api/v1/incidents/${params.id}/investigate`, { method: 'POST' })); load(); }
    catch (e: any) { setAi({ error: e.message }); } finally { setAiBusy(false); }
  };

  if (error && !inc) return <ErrorBox message={error} />;
  if (!inc) return <p>Loading…</p>;

  return (
    <div>
      <h1>{inc.title}</h1>
      <p><StatusBadge value={inc.status} /> <StatusBadge value={inc.severity} /> {inc.service && <span>· {inc.service.name}</span>}</p>
      {error && <ErrorBox message={error} />}
      <div className="toolbar" role="group" aria-label="Incident actions">
        {(NEXT_STATES[inc.status] ?? []).map((s) => (<button key={s} className="btn" onClick={() => transition(s)}>→ {s}</button>))}
        <button className="btn primary" onClick={investigate} disabled={aiBusy}>{aiBusy ? 'Analyzing…' : '✦ AI investigate'}</button>
      </div>

      {ai?.configured === false && <div className="alert info">{ai.message}</div>}
      {ai?.error && <ErrorBox message={ai.error} />}
      {(ai?.investigation || inc.investigations?.[0]) && (
        <InvestigationView inv={ai?.investigation ?? inc.investigations[0]} />
      )}

      <div className="grid two">
        <div>
          <div className="card">
            <h3>Investigation notes</h3>
            {inc.comments?.map((c: any) => (<p key={c.id}><strong>{c.author?.name}</strong> <span style={{ color: 'var(--muted)', fontSize: 12 }}>{new Date(c.createdAt).toLocaleString()}</span><br />{c.body}</p>))}
            <form onSubmit={sendComment} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <input className="input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a note…" aria-label="Add a note" required />
              <button className="btn primary">Post</button>
            </form>
          </div>
          <div className="card" style={{ marginTop: 16 }}>
            <h3>Assignees</h3>
            {inc.assignments?.map((a: any) => (<p key={a.user.id}>{a.user.name} ({a.user.email})</p>))}
            {!inc.assignments?.length && <p style={{ color: 'var(--muted)' }}>Unassigned</p>}
          </div>
        </div>
        <div className="card">
          <h3>Activity timeline</h3>
          <div className="timeline">
            {inc.activities?.map((a: any) => (<div key={a.id}><div style={{ fontSize: 13 }}><strong>{a.action}</strong></div><div style={{ fontSize: 12, color: 'var(--muted)' }}>{new Date(a.createdAt).toLocaleString()} {a.detail}</div></div>))}
          </div>
        </div>
      </div>
    </div>
  );
}

function InvestigationView({ inv }: { inv: any }) {
  return (
    <div className="card" style={{ margin: '16px 0', borderLeft: '4px solid var(--accent)' }}>
      <h3>AI investigation <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--muted)' }}>({inv.model}) · confidence {(inv.confidence * 100).toFixed(0)}%</span></h3>
      <p><strong>Summary:</strong> {inv.summary}</p>
      <p><strong>Probable cause (unverified hypothesis):</strong> {inv.probableCause}</p>
      {inv.confidenceNote && <p style={{ fontSize: 13, color: 'var(--muted)' }}>Confidence note: {inv.confidenceNote}</p>}
      <h4>Supporting evidence</h4>
      <ul>{inv.evidence?.map((e: any, i: number) => (<li key={i}><strong>{e.label}</strong> — {e.detail}</li>))}</ul>
      <h4>Alternative hypotheses</h4>
      <ul>{inv.hypotheses?.map((h: any, i: number) => (<li key={i}><strong>{h.title} ({h.likelihood})</strong> — {h.detail}</li>))}</ul>
      <h4>Next steps</h4><ul>{inv.nextSteps?.map((s: string, i: number) => (<li key={i}>{s}</li>))}</ul>
      <h4>Suggested remediation</h4><ul>{inv.remediation?.map((s: string, i: number) => (<li key={i}>{s}</li>))}</ul>
      {inv.warnings?.length > 0 && (<><h4>Warnings & uncertainties</h4><ul>{inv.warnings.map((s: string, i: number) => (<li key={i}>{s}</li>))}</ul></>)}
      <p style={{ fontSize: 12, color: 'var(--muted)' }}>AI output is advisory only. It never executes actions. Verify before changing production systems.</p>
    </div>
  );
}
