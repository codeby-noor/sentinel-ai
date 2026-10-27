'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { apiFetch, setOrgId } from '@/lib/api';

export interface Membership { organization: { id: string; name: string; slug: string }; role: string }
export interface User { id: string; email: string; name: string }

interface AuthState { user: User | null; memberships: Membership[]; orgId: string | null; loading: boolean; refresh: () => Promise<void>; logout: () => Promise<void>; selectOrg: (id: string) => void; }

const Ctx = createContext<AuthState>({ user: null, memberships: [], orgId: null, loading: true, refresh: async () => undefined, logout: async () => undefined, selectOrg: () => undefined });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [orgId, setOrg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const me = await apiFetch<{ user: User; memberships: Membership[] }>('/api/v1/auth/me');
      setUser(me.user);
      setMemberships(me.memberships);
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('sentinel:orgId') : null;
      const valid = stored && me.memberships.some((m) => m.organization.id === stored);
      const next = valid ? stored! : me.memberships[0]?.organization.id ?? null;
      setOrg(next);
      if (next) setOrgId(next);
    } catch {
      setUser(null); setMemberships([]); setOrg(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const logout = async () => {
    await apiFetch('/api/v1/auth/logout', { method: 'POST' }).catch(() => undefined);
    setUser(null); setOrg(null);
    if (typeof window !== 'undefined') window.location.href = '/login';
  };
  const selectOrg = (id: string) => { setOrg(id); setOrgId(id); window.location.reload(); };

  return <Ctx.Provider value={{ user, memberships, orgId, loading, refresh, logout, selectOrg }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
