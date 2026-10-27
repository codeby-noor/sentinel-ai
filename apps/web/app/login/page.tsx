'use client';
import { useState } from 'react';
import { apiFetch } from '@/lib/api';

const DEMO_EMAIL = 'user123@gmail.com';
const DEMO_PASSWORD = 'user@123';

export default function LoginPage() {
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      await apiFetch('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      window.location.href = '/';
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  };

  const fillDemo = () => { setEmail(DEMO_EMAIL); setPassword(DEMO_PASSWORD); setError(''); };

  return (
    <div className="card" style={{ maxWidth: 440 }}>
      <h1>Login</h1>
      {error && <div className="alert error" role="alert">{error}</div>}
      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        <label htmlFor="email">Email
          <input id="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="email" />
        </label>
        <label htmlFor="password">Password
          <span style={{ display: 'flex', gap: 8 }}>
            <input id="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? 'text' : 'password'} required autoComplete="current-password" />
            <button type="button" className="btn" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>{showPassword ? 'Hide' : 'Show'}</button>
          </span>
        </label>
        <button className="btn primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p style={{ fontSize: 14 }}><a href="/forgot-password">Forgot password?</a> · No account? <a href="/register">Register</a></p>
      <div className="alert info" aria-label="Demo account">
        <strong>Demo account</strong> (sample data only)<br />
        Email: <code className="mono">{DEMO_EMAIL}</code><br />
        Password: <code className="mono">{DEMO_PASSWORD}</code><br />
        <button type="button" className="btn" style={{ marginTop: 8 }} onClick={fillDemo}>Use demo account</button>
      </div>
      <p style={{ fontSize: 13, color: 'var(--muted)' }}>Seeded admin also works: demo@sentinel.dev / Sentinel123!</p>
    </div>
  );
}
