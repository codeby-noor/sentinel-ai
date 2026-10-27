import { validate } from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { RegisterDto } from './auth.dto';
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
