import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

function contextFor(request: any) {
  return { switchToHttp: () => ({ getRequest: () => request }) } as any;
}

describe('JwtAuthGuard', () => {
  it('accepts a valid session and attaches the current user', async () => {
    const request = { cookies: { sentinel_session: 'valid-token' }, headers: {} };
    const jwt = { verifyAsync: jest.fn().mockResolvedValue({ sub: 'user-1', sv: 0 }) };
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'user@example.com',
          sessionVersion: 0,
        }),
      },
    };

    await expect(new JwtAuthGuard(jwt as any, prisma as any).canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toEqual({ id: 'user-1', email: 'user@example.com' });
  });

  it('rejects missing, malformed, and expired sessions', async () => {
    const prisma = { user: { findUnique: jest.fn() } };
    const guardWithoutToken = new JwtAuthGuard({ verifyAsync: jest.fn() } as any, prisma as any);
    await expect(guardWithoutToken.canActivate(contextFor({ cookies: {}, headers: {} }))).rejects.toBeInstanceOf(UnauthorizedException);

    for (const reason of ['malformed token', 'jwt expired']) {
      const jwt = { verifyAsync: jest.fn().mockRejectedValue(new Error(reason)) };
      const guard = new JwtAuthGuard(jwt as any, prisma as any);
      await expect(
        guard.canActivate(contextFor({ cookies: { sentinel_session: 'bad-token' }, headers: {} })),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }
  });

  it('rejects sessions for missing users and revoked session versions', async () => {
    const request = { cookies: { sentinel_session: 'valid-token' }, headers: {} };
    const jwt = { verifyAsync: jest.fn().mockResolvedValue({ sub: 'user-1', sv: 0 }) };
    const missingUserGuard = new JwtAuthGuard(jwt as any, { user: { findUnique: jest.fn().mockResolvedValue(null) } } as any);
    await expect(missingUserGuard.canActivate(contextFor(request))).rejects.toBeInstanceOf(UnauthorizedException);

    const revokedGuard = new JwtAuthGuard(jwt as any, {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-1', sessionVersion: 1 }) },
    } as any);
    await expect(revokedGuard.canActivate(contextFor(request))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('does not convert database failures into unauthenticated responses', async () => {
    const request = { cookies: { sentinel_session: 'valid-token' }, headers: {} };
    const jwt = { verifyAsync: jest.fn().mockResolvedValue({ sub: 'user-1', sv: 0 }) };
    const databaseError = new Error('database unavailable');
    const guard = new JwtAuthGuard(jwt as any, {
      user: { findUnique: jest.fn().mockRejectedValue(databaseError) },
    } as any);

    await expect(guard.canActivate(contextFor(request))).rejects.toBe(databaseError);
  });
});
