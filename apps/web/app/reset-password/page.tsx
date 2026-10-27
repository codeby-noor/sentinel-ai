'use client';
import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PASSWORD_RULE_MESSAGE, isPasswordLengthValid } from '@/lib/validation';

export default function ResetPasswordPage({ searchParams }: { searchParams?: { token?: string } }) {
  const token = searchParams?.token ?? '';
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [serverError, setServerError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setServerError('');
    const errs: string[] = [];
    if (!token) errs.push('This reset link is missing its token. Request a new one.');
    if (!isPasswordLengthValid(form.password)) errs.push(PASSWORD_RULE_MESSAGE);
    if (form.confirmPassword !== form.password) errs.push('Passwords do not match.');
    setErrors(errs);
    if (errs.length) return;
    setBusy(true);
    try {
      await apiFetch('/api/v1/auth/reset-password', {
        method: 'POST', body: JSON.stringify({ token, password: form.password, confirmPassword: form.confirmPassword }),
      });
      setDone(true);
    } catch (err: any) { setServerError(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="card" style={{ maxWidth: 440 }}>
      <h1>Set a new password</h1>
      {serverError && <div className="alert error" role="alert">{serverError}</div>}
      {errors.length > 0 && (
        <div className="alert error" role="alert">
          <ul style={{ margin: 0, paddingLeft: 18 }}>{errors.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      )}
      {done ? (
        <div>
          <div className="alert ok" role="status">Password updated. Previous sessions were signed out — please log in again.</div>
          <p style={{ fontSize: 14 }}><a href="/login">Go to login</a></p>
        </div>
      ) : (
        <form onSubmit={submit} style={{ display: 'grid', gap: 12 }} noValidate>
          <label htmlFor="password">New password
            <span style={{ display: 'flex', gap: 8 }}>
              <input id="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} type={show ? 'text' : 'password'} required autoComplete="new-password" aria-describedby="pw-rule" />
              <button type="button" className="btn" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button>
            </span>
          </label>
          <p id="pw-rule" style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>{PASSWORD_RULE_MESSAGE}</p>
          <label htmlFor="confirmPassword">Confirm new password
            <input id="confirmPassword" className="input" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} type={show ? 'text' : 'password'} required autoComplete="new-password" />
          </label>
          <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Set new password'}</button>
        </form>
      )}
    </div>
  );
}
