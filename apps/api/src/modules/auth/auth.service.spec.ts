import { validate } from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './auth.dto';
import { PASSWORD_RULE_MESSAGE } from './password-policy';

function mockJwt() {
  return { signAsync: jest.fn().mockResolvedValue('jwt-test-token'), verifyAsync: jest.fn() } as any;
}

function mockPrisma(over: Record<string, any> = {}) {
  const tx = {
    user: { create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'u1', sessionVersion: 0, createdAt: new Date(), ...data })) },
    organization: { create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'o1', ...data })) },
    membership: { create: jest.fn().mockResolvedValue({}) },
    auditEvent: { create: jest.fn().mockResolvedValue({}) },
  };
  return {
    user: { findUnique: jest.fn().mockResolvedValue(null) },
    membership: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn().mockImplementation((cb: any) => cb(tx)),
    __tx: tx,
    ...over,
  } as any;
}

describe('registration password rule (exactly 8)', () => {
  it('DTO rejects 7- and 9-char passwords with the exact message', async () => {
    for (const pw of ['short77', 'toolong99']) {
      const dto = Object.assign(new RegisterDto(), { name: 'N', email: 'a@b.co', password: pw, confirmPassword: pw });
      const errors = await validate(dto);
      expect(errors.some((e) => JSON.stringify(e.constraints).includes(PASSWORD_RULE_MESSAGE))).toBe(true);
    }
  });

  it('DTO accepts exactly 8 characters', async () => {
    const dto = Object.assign(new RegisterDto(), { name: 'N', email: 'a@b.co', password: 'abcd1234', confirmPassword: 'abcd1234' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('service rejects 7/9-char passwords even if DTO validation is bypassed', async () => {
    for (const pw of ['short77', 'toolong99']) {
      const svc = new AuthService(mockPrisma(), mockJwt());
      await expect(svc.register({ name: 'N', email: 'a@b.co', password: pw, confirmPassword: pw } as any)).rejects.toThrow(PASSWORD_RULE_MESSAGE);
    }
  });

  it('service rejects confirmation mismatch', async () => {
    const svc = new AuthService(mockPrisma(), mockJwt());
    await expect(svc.register({ name: 'N', email: 'a@b.co', password: 'abcd1234', confirmPassword: 'abcd1235' } as any)).rejects.toThrow(/do not match/);
  });

  it('service rejects duplicate emails', async () => {
    const prisma = mockPrisma({ user: { findUnique: jest.fn().mockResolvedValue({ id: 'x' }) } });
    const svc = new AuthService(prisma, mockJwt());
    await expect(svc.register({ name: 'N', email: 'a@b.co', password: 'abcd1234', confirmPassword: 'abcd1234' } as any)).rejects.toThrow(/already exists/);
  });

  it('registration grants OWNER only of the newly created org (no escalation)', async () => {
    const prisma = mockPrisma();
    const svc = new AuthService(prisma, mockJwt());
    await svc.register({ name: 'N', email: 'a@b.co', password: 'abcd1234', confirmPassword: 'abcd1234' } as any);
    expect(prisma.__tx.organization.create).toHaveBeenCalledTimes(1);
    expect(prisma.__tx.membership.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: 'OWNER', organizationId: 'o1' }) }),
    );
  });
});

describe('demo login credentials', () => {
  it('user123@gmail.com / user@123 authenticates with the real hashing implementation', async () => {
    const hash = await bcrypt.hash('user@123', 12);
    const prisma = mockPrisma({ user: { findUnique: jest.fn().mockResolvedValue({ id: 'u9', email: 'user123@gmail.com', name: 'Demo User', passwordHash: hash, sessionVersion: 0 }) } });
    const out = await new AuthService(prisma, mockJwt()).login({ email: 'user123@gmail.com', password: 'user@123' });
    expect(out.user.email).toBe('user123@gmail.com');
  });

  it('wrong password for the demo account is rejected without revealing which field failed', async () => {
    const hash = await bcrypt.hash('user@123', 12);
    const prisma = mockPrisma({ user: { findUnique: jest.fn().mockResolvedValue({ id: 'u9', email: 'user123@gmail.com', passwordHash: hash, sessionVersion: 0 }) } });
    await expect(new AuthService(prisma, mockJwt()).login({ email: 'user123@gmail.com', password: 'wrongpwd' })).rejects.toThrow('Invalid email or password');
  });

  it('existing demo@sentinel.dev (11-char password) keeps working — login has no length rule', async () => {
    const hash = await bcrypt.hash('Sentinel123!', 12);
    const prisma = mockPrisma({ user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', email: 'demo@sentinel.dev', passwordHash: hash, sessionVersion: 0 }) } });
    const out = await new AuthService(prisma, mockJwt()).login({ email: 'demo@sentinel.dev', password: 'Sentinel123!' });
    expect(out.user.email).toBe('demo@sentinel.dev');
  });
});

describe('login and current session', () => {
  it('normalizes the email, verifies bcrypt, and returns a signed session with memberships', async () => {
    const hash = await bcrypt.hash('correct-password', 12);
    const memberships = [{ organization: { id: 'org-1' }, role: 'MEMBER' }];
    const prisma = mockPrisma({
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'user@example.com',
          name: 'Test User',
          passwordHash: hash,
          sessionVersion: 2,
        }),
      },
      membership: { findMany: jest.fn().mockResolvedValue(memberships) },
    });
    const jwt = mockJwt();
    const service = new AuthService(prisma, jwt);

    const result = await service.login({ email: ' USER@example.com ', password: 'correct-password' });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'user@example.com' } });
    expect(jwt.signAsync).toHaveBeenCalledWith({ sub: 'user-1', email: 'user@example.com', sv: 2 });
    expect(result.token).toBe('jwt-test-token');
    expect(result.memberships).toEqual(memberships);
  });

  it('uses the same invalid-credentials response for unknown users and wrong passwords', async () => {
    const serviceFor = (user: any) =>
      new AuthService(mockPrisma({ user: { findUnique: jest.fn().mockResolvedValue(user) } }), mockJwt());

    await expect(serviceFor(null).login({ email: 'missing@example.com', password: 'any-password' }))
      .rejects.toThrow('Invalid email or password');

    const hash = await bcrypt.hash('correct-password', 12);
    await expect(
      serviceFor({ id: 'user-1', passwordHash: hash }).login({ email: 'user@example.com', password: 'wrong-password' }),
    ).rejects.toThrow('Invalid email or password');
  });

  it('validates missing login fields at the DTO boundary', async () => {
    const errors = await validate(new LoginDto());
    expect(errors.map((error) => error.property).sort()).toEqual(['email', 'password']);
  });

  it('returns the authenticated user and memberships from the current-session lookup', async () => {
    const memberships = [{ organization: { id: 'org-1' }, role: 'MEMBER' }];
    const prisma = mockPrisma({
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'user@example.com',
          name: 'Test User',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
      },
      membership: { findMany: jest.fn().mockResolvedValue(memberships) },
    });
    const result = await new AuthService(prisma, mockJwt()).me('user-1');
    expect(result.user.email).toBe('user@example.com');
    expect(result.memberships).toEqual(memberships);
  });

  it('rejects a session whose user no longer exists', async () => {
    const service = new AuthService(mockPrisma(), mockJwt());
    await expect(service.me('missing-user')).rejects.toThrow('Session user not found');
  });
});
