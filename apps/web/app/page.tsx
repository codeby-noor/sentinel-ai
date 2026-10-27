'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { StatusBadge, Empty, ErrorBox } from '@/components/ui';

export default function DashboardPage() {
  const { orgId, loading } = useAuth();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orgId) return;
    apiFetch('/api/v1/analytics/dashboard').then(setData).catch((e) => setError(e.message));
  }, [orgId]);

  if (loading) return <p>Loading…</p>;
  if (!orgId) return <div className="alert info">Please <Link href="/login">log in</Link> to view your dashboard.</div>;
  if (error) return <ErrorBox message={error} />;
  if (!data) return <p>Loading dashboard…</p>;

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Operations overview</h1>
      <div className="grid kpi">
        <div className="card kpi"><div className="value">{data.totals.services}</div><div className="hint">Monitored services</div></div>
        <div className="card kpi"><div className="value">{data.totals.openIncidents}</div><div className="hint">Open incidents</div></div>
        <div className="card kpi"><div className="value">{data.totals.critical}</div><div className="hint">Critical open</div></div>
        <div className="card kpi"><div className="value">{(data.errorRate * 100).toFixed(1)}%</div><div className="hint">Error rate (HIGH+CRITICAL / all logs)</div></div>
        <div className="card kpi"><div className="value">{data.mttaSec != null ? Math.round(data.mttaSec / 60) + 'm' : '—'}</div><div className="hint">MTTA (mean ack − created)</div></div>
        <div className="card kpi"><div className="value">{data.mttrSec != null ? Math.round(data.mttrSec / 3600) + 'h' : '—'}</div><div className="hint">MTTR (mean resolved − created)</div></div>
      </div>

      <div className="grid two" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>Incident trend</h3>
          {data.trend?.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.trend}><XAxis dataKey="date" /><YAxis allowDecimals={false} /><Tooltip /><Line type="monotone" dataKey="count" stroke="#0e7c7b" strokeWidth={2} /></LineChart>
            </ResponsiveContainer>
          ) : <Empty title="No incidents in range" hint="Incidents created from failing health checks or critical logs will appear here." />}
        </div>
        <div className="card">
          <h3>Severity distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.bySeverity}><XAxis dataKey="severity" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill="#3553c7" /></BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid two" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>Services</h3>
          <table className="table"><thead><tr><th>Service</th><th>Status</th><th>Latency</th></tr></thead>
            <tbody>{data.services?.map((s: any) => (<tr key={s.id}><td><Link href={`/services/${s.id}`}>{s.name}</Link></td><td><StatusBadge value={s.status} /></td><td>{s.lastLatencyMs != null ? `${s.lastLatencyMs} ms` : '—'}</td></tr>))}</tbody></table>
        </div>
        <div className="card">
          <h3>Recent incidents</h3>
          {data.recentIncidents?.map((i: any) => (<p key={i.id}><Link href={`/incidents/${i.id}`}>{i.title}</Link> <StatusBadge value={i.status} /></p>)) || <Empty title="No incidents yet" />}
          <h3 style={{ marginTop: 16 }}>Recent activity</h3>
          {data.activity?.slice(0, 8).map((a: any) => (<p key={a.id} style={{ fontSize: 13 }}><span className="mono">{new Date(a.createdAt).toLocaleString()}</span> — {a.action}</p>))}
        </div>
      </div>
    </div>
  );
}
