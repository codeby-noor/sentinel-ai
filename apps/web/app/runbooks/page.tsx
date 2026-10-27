'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { ErrorBox } from '@/components/ui';

export default function RunbooksPage() {
  const { orgId } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ title: '', category: 'general', contentMd: '' });

  const load = () => { if (!orgId) return; apiFetch<any[]>(`/api/v1/runbooks${search ? `?search=${encodeURIComponent(search)}` : ''}`).then(setItems).catch((e) => setError((e as Error).message)); };
  useEffect(() => { load(); }, [orgId]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await apiFetch('/api/v1/runbooks', { method: 'POST', body: JSON.stringify(form) }); setForm({ title: '', category: 'general', contentMd: '' }); load(); }
    catch (err: any) { setError(err.message); }
  };

  return (
    <div>
      <h1>Runbooks</h1>
      {error && <ErrorBox message={error} />}
      <div className="grid two">
        <div className="card">
          <h3>Knowledge base</h3>
          <div className="toolbar"><input className="input" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search runbooks" /><button className="btn" onClick={load}>Search</button></div>
          {items.map((r) => (<details key={r.id} style={{ marginBottom: 10 }}><summary><strong>{r.title}</strong> <span style={{ color: 'var(--muted)', fontSize: 12 }}>({r.category})</span></summary><pre className="mono" style={{ background: 'var(--bg)', padding: 12, borderRadius: 8 }}>{r.contentMd.slice(0, 3000)}</pre></details>))}
          {!items.length && <p style={{ color: 'var(--muted)' }}>No runbooks yet.</p>}
        </div>
        <div className="card">
          <h3>New runbook</h3>
          <form onSubmit={create} style={{ display: 'grid', gap: 10 }}>
            <input className="input" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required aria-label="Title" />
            <input className="input" placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} aria-label="Category" />
            <textarea className="textarea" placeholder="Markdown content…" value={form.contentMd} onChange={(e) => setForm({ ...form, contentMd: e.target.value })} required aria-label="Content" />
            <button className="btn primary">Save runbook</button>
          </form>
        </div>
      </div>
    </div>
  );
}
