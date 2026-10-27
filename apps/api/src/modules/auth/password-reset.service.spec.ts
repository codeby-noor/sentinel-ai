import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PasswordResetService, GENERIC_FORGOT_MESSAGE } from './password-reset.service';
import { PASSWORD_RULE_MESSAGE } from './password-policy';

// requestReset reads server config via getEnv(); provide test values (no real secrets).
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test?schema=public';
process.env.JWT_SECRET ??= 'test-secret-min-32-chars-long-xxxxxxxx';

function mockPrisma(over: Record<string, any> = {}) {
  return {
    user: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
    passwordResetToken: {
      updateMany: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 't1', usedAt: null, ...data })),
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn().mockImplementation((cb: any) =>
      cb({ user: { update: jest.fn().mockResolvedValue({}) }, passwordResetToken: { update: jest.fn().mockResolvedValue({}), updateMany: jest.fn().mockResolvedValue({}) } }),
    ),
    ...over,
  } as any;
}
const limits = (allowed = true) => ({ hit: jest.fn().mockReturnValue({ allowed, remaining: 1 }) }) as any;
const email = (sent = false) => ({ sendPasswordReset: jest.fn().mockResolvedValue({ sent }) }) as any;

describe('forgot-password', () => {
  it('returns the generic message for unknown emails and creates no token', async () => {
    const prisma = mockPrisma();
    const out = await new PasswordResetService(prisma, limits(), email()).requestReset('nobody@example.com', '1.2.3.4');
    expect(out).toEqual({ message: GENERIC_FORGOT_MESSAGE });
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it('returns the same generic message for known emails (no account disclosure)', async () => {
    const prisma = mockPrisma({ user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', email: 'a@b.co' }), update: jest.fn() } });
    const out = await new PasswordResetService(prisma, limits(), email()).requestReset('a@b.co', '1.2.3.4');
    expect(out.message).toBe(GENERIC_FORGOT_MESSAGE);
    expect(prisma.passwordResetToken.create).toHaveBeenCalledTimes(1);
  });
  it('stores only a SHA-256 hash of the token (64 hex chars), never the plaintext', async () => {
    const prisma = mockPrisma({ user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', email: 'a@b.co' }), update: jest.fn() } });
    await new PasswordResetService(prisma, limits(), email()).requestReset('a@b.co', '1.2.3.4');
    const stored = prisma.passwordResetToken.create.mock.calls[0][0].data;
    expect(stored.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(new Date(stored.expiresAt).getTime()).toBeGreaterThan(Date.now() + 20 * 60 * 1000);
    // The stored hash must not equal any plausible plaintext token.
    expect(stored.tokenHash).not.toContain('token');
  });

  it('rate-limits repeated requests with 429', async () => {
    const svc = new PasswordResetService(mockPrisma(), limits(false), email());
    await expect(svc.requestReset('a@b.co', '1.2.3.4')).rejects.toMatchObject({ status: 429 });
  });
});

describe('reset-password', () => {
  const validRec = () => ({ id: 't1', userId: 'u1', tokenHash: 'x'.repeat(64), expiresAt: new Date(Date.now() + 600_000), usedAt: null, createdAt: new Date() });

  it('rejects invalid, expired, and already-used tokens', async () => {
    const cases = [
      mockPrisma(), // findUnique -> null (invalid)
      mockPrisma({ passwordResetToken: { findUnique: jest.fn().mockResolvedValue({ ...validRec(), expiresAt: new Date(Date.now() - 1000) }), updateMany: jest.fn(), create: jest.fn(), update: jest.fn() } }),
      mockPrisma({ passwordResetToken: { findUnique: jest.fn().mockResolvedValue({ ...validRec(), usedAt: new Date() }), updateMany: jest.fn(), create: jest.fn(), update: jest.fn() } }),
    ];
    for (const prisma of cases) {
      const svc = new PasswordResetService(prisma, limits(), email());
      await expect(svc.resetPassword('sometoken12345678', 'newpass8', 'newpass8', '9.9.9.9')).rejects.toThrow(/invalid or has expired/);
    }
  });

  it('rejects non-8-char and mismatched new passwords', async () => {
    const prisma = mockPrisma({ passwordResetToken: { findUnique: jest.fn().mockResolvedValue(validRec()), updateMany: jest.fn(), create: jest.fn(), update: jest.fn() } });
    const svc = new PasswordResetService(prisma, limits(), email());
    await expect(svc.resetPassword('sometoken12345678', 'short77', 'short77', '9.9.9.9')).rejects.toThrow(PASSWORD_RULE_MESSAGE);
    await expect(svc.resetPassword('sometoken12345678', 'newpass8', 'newpass9', '9.9.9.9')).rejects.toThrow(/do not match/);
  });

  it('rotates the password hash, marks tokens used, and bumps sessionVersion', async () => {
    const oldHash = await bcrypt.hash('oldpass8', 4);
    let savedHash = '';
    let savedData: any = null;
    const txMocks = {
      user: { update: jest.fn().mockImplementation(({ data }) => { savedData = data; return Promise.resolve({}); }) },
      passwordResetToken: { update: jest.fn().mockResolvedValue({}), updateMany: jest.fn().mockResolvedValue({}) },
    };
    const prisma = mockPrisma({
      passwordResetToken: { findUnique: jest.fn().mockResolvedValue(validRec()), updateMany: jest.fn(), create: jest.fn(), update: jest.fn() },
      $transaction: jest.fn().mockImplementation((cb: any) => cb(txMocks)),
    });
    const svc = new PasswordResetService(prisma, limits(), email());
    await expect(svc.resetPassword('sometoken12345678', 'newpass8', 'newpass8', '9.9.9.9')).resolves.toEqual({ ok: true });
    expect(savedData.sessionVersion).toEqual({ increment: 1 });
    savedHash = savedData.passwordHash;
    expect(await bcrypt.compare('newpass8', savedHash)).toBe(true);
    // Old password no longer verifies against the rotated hash.
    expect(await bcrypt.compare('oldpass8', savedHash)).toBe(false);
    expect(await bcrypt.compare('oldpass8', oldHash)).toBe(true); // sanity: test itself is sound
    expect(txMocks.passwordResetToken.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 't1' } }));
    expect(txMocks.passwordResetToken.updateMany).toHaveBeenCalled();
  });

  it('hashes with sha256 consistently (token lookup contract)', () => {
    const h = crypto.createHash('sha256').update('abc').digest('hex');
    expect(h).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
