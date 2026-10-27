'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { ErrorBox } from '@/components/ui';

export default function AnalyticsPage() {
  const { orgId } = useAuth();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });

  const load = () => {
    if (!orgId) return;
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(range).filter(([, v]) => v))).toString();
    apiFetch(`/api/v1/analytics/overview${qs ? '?' + qs : ''}`).then(setData).catch((e) => setError(e.message));
  };
  useEffect(() => { load(); }, [orgId]);

  return (
    <div>
      <h1>Analytics</h1>
      {error && <ErrorBox message={error} />}
      <div className="toolbar">
        <input className="input" style={{ maxWidth: 200 }} type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} aria-label="From date" />
        <input className="input" style={{ maxWidth: 200 }} type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} aria-label="To date" />
        <button className="btn primary" onClick={load}>Apply range</button>
      </div>
      {data ? (
        <>
          <div className="grid kpi">
            <div className="card kpi"><div className="value">{data.mttaSec != null ? (data.mttaSec / 60).toFixed(1) + 'm' : '—'}</div><div className="hint">MTTA</div></div>
            <div className="card kpi"><div className="value">{data.mttrSec != null ? (data.mttrSec / 3600).toFixed(1) + 'h' : '—'}</div><div className="hint">MTTR</div></div>
            <div className="card kpi"><div className="value">{(data.errorRate * 100).toFixed(1)}%</div><div className="hint">Error rate</div></div>
            <div className="card kpi"><div className="value">{data.latency.p50Ms ?? '—'}{data.latency.p50Ms ? 'ms' : ''}</div><div className="hint">Latency p50</div></div>
            <div className="card kpi"><div className="value">{data.latency.p95Ms ?? '—'}{data.latency.p95Ms ? 'ms' : ''}</div><div className="hint">Latency p95</div></div>
          </div>
          <div className="card" style={{ marginTop: 16 }}>
            <h3>How metrics are calculated</h3>
            <ul style={{ fontSize: 14 }}>
              <li><strong>MTTA:</strong> {data.methods.mtta}</li>
              <li><strong>MTTR:</strong> {data.methods.mttr}</li>
              <li><strong>Error rate:</strong> {data.methods.errorRate}</li>
              <li><strong>Latency:</strong> {data.methods.latency}</li>
            </ul>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>All metrics are computed from stored records in the selected range. No values are invented.</p>
          </div>
        </>
      ) : <p>Loading…</p>}
    </div>
  );
}
