'use client';
import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { isEmailValid } from '@/lib/validation';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [devUrl, setDevUrl] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setDevUrl('');
    if (!isEmailValid(email)) { setError('Enter a valid email address.'); return; }
    setBusy(true);
    try {
      const res = await apiFetch<{ message: string; devResetUrl?: string }>('/api/v1/auth/forgot-password', {
        method: 'POST', body: JSON.stringify({ email }),
      });
      setDone(res.message);
      if (res.devResetUrl) setDevUrl(res.devResetUrl);
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="card" style={{ maxWidth: 440 }}>
      <h1>Forgot password</h1>
      {error && <div className="alert error" role="alert">{error}</div>}
      {done ? (
        <div>
          <div className="alert ok" role="status">{done}</div>
          {devUrl && (
            <div className="alert info">
              Development mode (no email provider): <a href={devUrl}>open the reset link</a>.
            </div>
          )}
          <p style={{ fontSize: 14 }}><a href="/login">Back to login</a></p>
        </div>
      ) : (
        <form onSubmit={submit} style={{ display: 'grid', gap: 12 }} noValidate>
          <label htmlFor="email">Email
            <input id="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="email" />
          </label>
          <button className="btn primary" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
        </form>
      )}
      <p style={{ fontSize: 14 }}><a href="/login">Back to login</a></p>
    </div>
  );
}
