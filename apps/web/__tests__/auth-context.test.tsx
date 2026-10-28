import { render, screen } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/lib/auth-context';

function AuthStatus() {
  const { user, loading } = useAuth();
  if (loading) return <div>Checking session</div>;
  return <div>{user?.email ?? 'Signed out'}</div>;
}

describe('AuthProvider session refresh', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    if (originalFetch) global.fetch = originalFetch;
    else delete (global as any).fetch;
  });

  it('restores a valid session through the credentialed /me request', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        user: { id: 'user-1', email: 'user@example.com', name: 'Test User' },
        memberships: [],
      }),
    });
    global.fetch = fetchMock;

    render(<AuthProvider><AuthStatus /></AuthProvider>);

    expect(await screen.findByText('user@example.com')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/api/v1/auth/me',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('treats a genuine unauthenticated response as signed out after loading', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: ['Not authenticated'] }),
    });

    render(<AuthProvider><AuthStatus /></AuthProvider>);

    expect(await screen.findByText('Signed out')).toBeInTheDocument();
  });
});
