import { ForbiddenException } from '@nestjs/common';
import { OrgGuard } from './org.guard';

function contextFor(request: any) {
  return { switchToHttp: () => ({ getRequest: () => request }) } as any;
}

describe('OrgGuard', () => {
  it('requires an organization context', async () => {
    const guard = new OrgGuard({ membership: { findUnique: jest.fn() } } as any);
    await expect(
      guard.canActivate(contextFor({ user: { id: 'user-1' }, headers: {}, query: {}, body: {} })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects users without membership in the requested organization', async () => {
    const guard = new OrgGuard({ membership: { findUnique: jest.fn().mockResolvedValue(null) } } as any);
    const request = {
      user: { id: 'user-1' },
      headers: { 'x-org-id': 'org-2' },
      query: {},
      body: {},
    };

    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('sets the organization context for a member', async () => {
    const membership = { userId: 'user-1', organizationId: 'org-1', role: 'MEMBER' };
    const prisma = { membership: { findUnique: jest.fn().mockResolvedValue(membership) } };
    const request = {
      user: { id: 'user-1' },
      headers: { 'x-org-id': 'org-1' },
      query: {},
      body: {},
    };

    await expect(new OrgGuard(prisma as any).canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.orgId).toBe('org-1');
    expect(request.membership).toBe(membership);
  });
});
