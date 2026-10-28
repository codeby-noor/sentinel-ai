import { AuthController } from './auth.controller';

describe('AuthController session cookies', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'production';
    process.env.COOKIE_SECURE = 'false';
    process.env.DATABASE_URL = 'postgresql://localhost/test';
    process.env.JWT_SECRET = 'test-secret-with-more-than-thirty-two-characters';
  });

  it('sets a cross-origin production cookie with secure attributes', async () => {
    const auth = {
      login: jest.fn().mockResolvedValue({
        token: 'test-token',
        user: { id: 'user-1' },
        memberships: [],
      }),
    };
    const controller = new AuthController(auth as any, {} as any);
    const response = { cookie: jest.fn() } as any;

    await controller.login({ email: 'user@example.com', password: 'password' }, response);

    expect(response.cookie).toHaveBeenCalledWith(
      'sentinel_session',
      'test-token',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'none',
        secure: true,
        path: '/',
        maxAge: 7 * 24 * 3600 * 1000,
      }),
    );
  });

  it('clears the session cookie using matching production attributes', async () => {
    const controller = new AuthController({} as any, {} as any);
    const response = { clearCookie: jest.fn() } as any;

    await controller.logout(response);

    expect(response.clearCookie).toHaveBeenCalledWith(
      'sentinel_session',
      expect.objectContaining({ sameSite: 'none', secure: true, path: '/' }),
    );
  });
});
