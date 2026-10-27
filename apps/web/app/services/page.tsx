'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { StatusBadge, ErrorBox } from '@/components/ui';

export default function ServicesPage() {
  const { orgId } = useAuth();
  const [services, setServices] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', healthCheckUrl: '', description: '' });

  const load = () => { if (!orgId) return; apiFetch<any[]>('/api/v1/services').then(setServices).catch((e) => setError((e as Error).message)); };
  useEffect(() => { load(); }, [orgId]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    try { await apiFetch('/api/v1/services', { method: 'POST', body: JSON.stringify(form) }); setForm({ name: '', healthCheckUrl: '', description: '' }); load(); }
    catch (err: any) { setError(err.message); }
  };

  return (
    <div>
      <h1>Services</h1>
      {error && <ErrorBox message={error} />}
      <div className="card">
        <h3>Register service</h3>
        <form onSubmit={create} style={{ display: 'grid', gap: 10, maxWidth: 520 }}>
          <input className="input" placeholder="Service name (e.g. checkout-api)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required aria-label="Service name" />
          <input className="input" placeholder="Health-check URL (https://…/health)" value={form.healthCheckUrl} onChange={(e) => setForm({ ...form, healthCheckUrl: e.target.value })} aria-label="Health check URL" />
          <input className="input" placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} aria-label="Description" />
          <button className="btn primary">Add service</button>
        </form>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <table className="table"><thead><tr><th>Name</th><th>Status</th><th>Latency</th><th>Last check</th></tr></thead>
          <tbody>{services.map((s) => (<tr key={s.id}><td><Link href={`/services/${s.id}`}>{s.name}</Link>{s._count?.incidents ? <span className="badge OPEN" style={{ marginLeft: 8 }}>{s._count.incidents} open</span> : null}</td><td><StatusBadge value={s.status} /></td><td>{s.lastLatencyMs ?? '—'}</td><td>{s.lastCheckedAt ? new Date(s.lastCheckedAt).toLocaleString() : 'never'}</td></tr>))}</tbody></table>
        {!services.length && <p style={{ color: 'var(--muted)' }}>No services yet — register your first service above.</p>}
      </div>
    </div>
  );
}
