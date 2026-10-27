'use client';
import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PASSWORD_RULE_MESSAGE, isEmailValid, isPasswordLengthValid } from '@/lib/validation';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [show, setShow] = useState({ password: false, confirm: false });
  const [errors, setErrors] = useState<string[]>([]);
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: any) => setForm({ ...form, [k]: e.target.value });

  const validate = (): string[] => {
    const errs: string[] = [];
    if (!form.name.trim()) errs.push('Full name is required.');
    if (!isEmailValid(form.email)) errs.push('Enter a valid email address.');
    if (!isPasswordLengthValid(form.password)) errs.push(PASSWORD_RULE_MESSAGE);
    if (form.confirmPassword !== form.password) errs.push('Passwords do not match.');
    return errs;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setServerError('');
    const errs = validate();
    setErrors(errs);
    if (errs.length) return;
    setBusy(true);
    try {
      await apiFetch('/api/v1/auth/register', { method: 'POST', body: JSON.stringify(form) });
      window.location.href = '/';
    } catch (err: any) { setServerError(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <h1>Create account</h1>
      {serverError && <div className="alert error" role="alert">{serverError}</div>}
      {errors.length > 0 && (
        <div className="alert error" role="alert">
          <ul style={{ margin: 0, paddingLeft: 18 }}>{errors.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      )}
      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }} noValidate>
        <label htmlFor="name">Full name
          <input id="name" className="input" value={form.name} onChange={set('name')} required autoComplete="name" aria-describedby="pw-rule" />
        </label>
        <label htmlFor="email">Email
          <input id="email" className="input" value={form.email} onChange={set('email')} type="email" required autoComplete="email" />
        </label>
        <label htmlFor="password">Password
          <span style={{ display: 'flex', gap: 8 }}>
            <input id="password" className="input" value={form.password} onChange={set('password')} type={show.password ? 'text' : 'password'} required autoComplete="new-password" aria-describedby="pw-rule" />
            <button type="button" className="btn" onClick={() => setShow({ ...show, password: !show.password })} aria-label={show.password ? 'Hide password' : 'Show password'}>{show.password ? 'Hide' : 'Show'}</button>
          </span>
        </label>
        <p id="pw-rule" style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>{PASSWORD_RULE_MESSAGE}</p>
        <label htmlFor="confirmPassword">Confirm password
          <span style={{ display: 'flex', gap: 8 }}>
            <input id="confirmPassword" className="input" value={form.confirmPassword} onChange={set('confirmPassword')} type={show.confirm ? 'text' : 'password'} required autoComplete="new-password" />
            <button type="button" className="btn" onClick={() => setShow({ ...show, confirm: !show.confirm })} aria-label={show.confirm ? 'Hide confirmation' : 'Show confirmation'}>{show.confirm ? 'Hide' : 'Show'}</button>
          </span>
        </label>
        <button className="btn primary" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
      </form>
      <p style={{ fontSize: 14 }}>Have an account? <a href="/login">Login</a></p>
    </div>
  );
}
