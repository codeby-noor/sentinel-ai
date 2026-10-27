import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PASSWORD_RULE_MESSAGE, isEmailValid, isPasswordLengthValid } from '@/lib/validation';
import RegisterPage from '@/app/register/page';
import LoginPage from '@/app/login/page';
import ForgotPasswordPage from '@/app/forgot-password/page';
import ResetPasswordPage from '@/app/reset-password/page';

describe('validation helpers', () => {
  it('accepts exactly 8 characters', () => {
    expect(isPasswordLengthValid('abcd1234')).toBe(true);
    expect(isPasswordLengthValid('user@123')).toBe(true);
  });
  it('rejects shorter or longer passwords', () => {
    expect(isPasswordLengthValid('short77')).toBe(false);
    expect(isPasswordLengthValid('toolong99')).toBe(false);
    expect(isPasswordLengthValid('')).toBe(false);
  });
  it('validates email shape', () => {
    expect(isEmailValid('user123@gmail.com')).toBe(true);
    expect(isEmailValid('not-an-email')).toBe(false);
  });
  it('uses the exact required message', () => {
    expect(PASSWORD_RULE_MESSAGE).toBe('Password must be exactly 8 characters.');
  });
});

describe('RegisterPage', () => {
  it('shows the exact-8 rule and rejects mismatched/short passwords inline', async () => {
    render(<RegisterPage />);
    expect(screen.getAllByText('Password must be exactly 8 characters.').length).toBeGreaterThanOrEqual(1);
    fireEvent.change(screen.getByLabelText(/full name/i, { selector: 'input' }), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText(/email/i, { selector: 'input' }), { target: { value: 't@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password/i, { selector: 'input' }), { target: { value: 'short77' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i, { selector: 'input' }), { target: { value: 'different' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    const alerts = await screen.findByRole('alert');
    expect(alerts.textContent).toContain('Password must be exactly 8 characters.');
    expect(alerts.textContent).toContain('Passwords do not match.');
  });
});

describe('LoginPage', () => {
  it('shows demo credentials and fills them without bypassing auth', () => {
    render(<LoginPage />);
    expect(screen.getByText('user123@gmail.com')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /use demo account/i }));
    expect((screen.getByLabelText(/email/i, { selector: 'input' }) as HTMLInputElement).value).toBe('user123@gmail.com');
    expect((screen.getByLabelText(/^password/i, { selector: 'input' }) as HTMLInputElement).value).toBe('user@123');
    expect(screen.getByRole('link', { name: /forgot password/i })).toBeInTheDocument();
  });
});

describe('ForgotPasswordPage', () => {
  it('rejects invalid email inline and shows the generic message on success', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ message: 'If an account exists' }) });
    (global as any).fetch = fetchMock;
    try {
      render(<ForgotPasswordPage />);
      fireEvent.change(screen.getByLabelText(/email/i, { selector: 'input' }), { target: { value: 'bad' } });
      fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));
      expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText(/email/i, { selector: 'input' }), { target: { value: 'a@b.co' } });
      fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));
      expect(await screen.findByText('If an account exists')).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      delete (global as any).fetch;
    }
  });
});

describe('ResetPasswordPage', () => {
  it('validates length + confirmation and posts the token on success', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ ok: true }) });
    (global as any).fetch = fetchMock;
    try {
      render(<ResetPasswordPage searchParams={{ token: '0123456789abcdef' }} />);
      fireEvent.change(screen.getByLabelText(/^new password/i, { selector: 'input' }), { target: { value: 'newpass8' } });
      fireEvent.change(screen.getByLabelText(/confirm new password/i, { selector: 'input' }), { target: { value: 'newpass9' } });
      fireEvent.click(screen.getByRole('button', { name: /set new password/i }));
      expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText(/confirm new password/i, { selector: 'input' }), { target: { value: 'newpass8' } });
      fireEvent.click(screen.getByRole('button', { name: /set new password/i }));
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      expect(await screen.findByText(/previous sessions were signed out/i)).toBeInTheDocument();
    } finally {
      delete (global as any).fetch;
    }
  });
});
