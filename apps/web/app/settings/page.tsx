'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { ErrorBox } from '@/components/ui';

export default function SettingsPage() {
  const { orgId, user } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [invite, setInvite] = useState({ email: '', role: 'MEMBER' });
  const [name, setName] = useState('');

  const load = () => { if (!orgId) return; apiFetch<any[]>(`/api/v1/orgs/${orgId}/members`).then(setMembers).catch((e) => setError((e as Error).message)); };
  useEffect(() => { load(); }, [orgId]);
  useEffect(() => { if (user) setName(user.name); }, [user]);

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await apiFetch(`/api/v1/orgs/${orgId}/members`, { method: 'POST', body: JSON.stringify(invite) }); setInvite({ email: '', role: 'MEMBER' }); load(); }
    catch (err: any) { setError(err.message); }
  };
  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await apiFetch('/api/v1/auth/profile', { method: 'PATCH', body: JSON.stringify({ name }) }); }
    catch (err: any) { setError(err.message); }
  };

  return (
    <div>
      <h1>Settings</h1>
      {error && <ErrorBox message={error} />}
      <div className="grid two">
        <div className="card">
          <h3>Profile</h3>
          <form onSubmit={saveProfile} style={{ display: 'flex', gap: 8 }}>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} aria-label="Display name" />
            <button className="btn primary">Save</button>
          </form>
          <h3 style={{ marginTop: 20 }}>Team members</h3>
          <table className="table"><thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead>
            <tbody>{members.map((m) => (<tr key={m.userId ?? m.user.id}><td>{m.user.name}</td><td>{m.user.email}</td><td>{m.role}</td></tr>))}</tbody></table>
        </div>
        <div className="card">
          <h3>Invite member</h3>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>The invited person must already have an account (they register first), then you add them by email.</p>
          <form onSubmit={sendInvite} style={{ display: 'grid', gap: 10 }}>
            <input className="input" placeholder="teammate@company.com" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} required aria-label="Invite email" />
            <select className="select" value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })} aria-label="Role"><option>MEMBER</option><option>ADMIN</option></select>
            <button className="btn primary">Add to organization</button>
          </form>
        </div>
      </div>
    </div>
  );
}
