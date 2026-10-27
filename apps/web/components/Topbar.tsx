'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';

export function Topbar() {
  const { user, memberships, orgId, selectOrg, logout } = useAuth();
  const [theme, setTheme] = useState('light');
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!user) return;
    apiFetch<any[]>('/api/v1/notifications').then((n) => setUnread(n.filter((x) => !x.readAt).length)).catch(() => undefined);
  }, [user]);

  return (
    <header className="topbar">
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <label htmlFor="org" style={{ fontSize: 13, color: 'var(--muted)' }}>Organization</label>
        <select id="org" className="select" style={{ width: 220 }} value={orgId ?? ''} onChange={(e) => selectOrg(e.target.value)} aria-label="Select organization">
          {memberships.map((m) => (
            <option key={m.organization.id} value={m.organization.id}>{m.organization.name} ({m.role})</option>
          ))}
        </select>
        {unread > 0 && <span className="badge HIGH" aria-label={`${unread} unread notifications`}>{unread} unread</span>}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button className="btn" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label="Toggle color theme">{theme === 'light' ? 'Dark' : 'Light'} mode</button>
        {user ? (<><span style={{ fontSize: 14 }}>{user.name}</span><button className="btn" onClick={logout}>Logout</button></>) : (<a className="btn primary" href="/login">Login</a>)}
      </div>
    </header>
  );
}
