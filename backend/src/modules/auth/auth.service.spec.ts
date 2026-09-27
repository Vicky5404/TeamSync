import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppConfig } from '../../config/app-config.js';
import type { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import type { QueueService } from '../../infrastructure/queue/queue.service.js';
import type { ActivityService } from '../activity/activity.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { InvitationsService } from '../organizations/invitations.service.js';
import type { OrganizationsService } from '../organizations/organizations.service.js';
import type { UsersRepository } from '../users/users.repository.js';

import { AuthService, tombstoneEmail } from './auth.service.js';
import type { LoginAttemptsService } from './login-attempts.service.js';
import type { PasswordService } from './password.service.js';
import type { SessionsService } from './sessions.service.js';
import type { TokenService } from './token.service.js';
import type { UserTokensService } from './user-tokens.service.js';

const user = {
  id: 'user-1',
  email: 'demo@flowsync.dev',
  name: 'Demo',
  passwordHash: 'hash',
  avatarUrl: null,
  avatarKey: null,
  jobTitle: null,
  timezone: 'UTC',
  emailVerifiedAt: new Date(),
  createdAt: new Date(),
};

describe('AuthService.login', () => {
  const users = { findByEmail: vi.fn(), update: vi.fn() };
  const passwords = {
    verify: vi.fn(),
    verifyDummy: vi.fn(),
    needsRehash: vi.fn(() => false),
    hash: vi.fn(),
  };
  const sessions = { create: vi.fn(), ttlMs: vi.fn(() => 1000) };
  const tokens = { issueAccessToken: vi.fn() };
  const attempts = { lockedFor: vi.fn(), recordFailure: vi.fn(), reset: vi.fn() };
  const config = { auth: { requireEmailVerification: true } } as AppConfig;
  let service: AuthService;

  beforeEach(() => {
    vi.resetAllMocks();
    passwords.needsRehash.mockReturnValue(false);
    attempts.lockedFor.mockResolvedValue(0);
    sessions.create.mockResolvedValue({ session: { id: 'session-1' }, refreshToken: 'refresh' });
    tokens.issueAccessToken.mockResolvedValue({ accessToken: 'access', expiresIn: 900 });
    service = new AuthService(
      {} as PrismaService,
      users as unknown as UsersRepository,
      passwords as unknown as PasswordService,
      sessions as unknown as SessionsService,
      tokens as unknown as TokenService,
      {} as UserTokensService,
      attempts as unknown as LoginAttemptsService,
      {} as InvitationsService,
      {} as OrganizationsService,
      {} as ActivityService,
      {} as AuditService,
      {} as QueueService,
      config,
    );
  });

  it('signs in with valid credentials and never returns the password hash', async () => {
    users.findByEmail.mockResolvedValue(user);
    passwords.verify.mockResolvedValue(true);
    const result = await service.login(
      { email: user.email, password: 'secret', rememberMe: true },
      { ipAddress: undefined, userAgent: undefined },
    );
    expect(result.body.accessToken).toBe('access');
    expect(result.cookieMaxAgeMs).toBe(1000);
    expect(JSON.stringify(result.body)).not.toContain('hash');
    expect(attempts.reset).toHaveBeenCalledWith(user.email);
  });

  it('uses a session cookie when "keep me signed in" is off', async () => {
    users.findByEmail.mockResolvedValue(user);
    passwords.verify.mockResolvedValue(true);
    const result = await service.login(
      { email: user.email, password: 'secret' },
      { ipAddress: undefined, userAgent: undefined },
    );
    expect(result.cookieMaxAgeMs).toBeUndefined();
  });

  it('does the same work for unknown emails and records the failure', async () => {
    users.findByEmail.mockResolvedValue(null);
    await expect(
      service.login(
        { email: 'ghost@example.com', password: 'x' },
        { ipAddress: undefined, userAgent: undefined },
      ),
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
    expect(passwords.verifyDummy).toHaveBeenCalled();
    expect(attempts.recordFailure).toHaveBeenCalledWith('ghost@example.com');
  });

  it('locks the account after too many failures without checking the password', async () => {
    attempts.lockedFor.mockResolvedValue(600);
    await expect(
      service.login(
        { email: user.email, password: 'secret' },
        { ipAddress: undefined, userAgent: undefined },
      ),
    ).rejects.toMatchObject({
      code: 'ACCOUNT_LOCKED',
    });
    expect(users.findByEmail).not.toHaveBeenCalled();
  });

  it('requires a verified email', async () => {
    users.findByEmail.mockResolvedValue({ ...user, emailVerifiedAt: null });
    passwords.verify.mockResolvedValue(true);
    await expect(
      service.login(
        { email: user.email, password: 'secret' },
        { ipAddress: undefined, userAgent: undefined },
      ),
    ).rejects.toMatchObject({
      code: 'EMAIL_NOT_VERIFIED',
    });
    expect(sessions.create).not.toHaveBeenCalled();
  });
});

describe('AuthService.deleteAccount', () => {
  const calls: string[] = [];
  const tx = {
    task: { updateMany: vi.fn(() => calls.push('unassign tasks')) },
    membership: { deleteMany: vi.fn(() => calls.push('delete memberships')) },
    notification: { deleteMany: vi.fn(() => calls.push('delete notifications')) },
    userToken: { deleteMany: vi.fn(() => calls.push('delete tokens')) },
    user: { update: vi.fn(() => calls.push('anonymize user')) },
  };
  const prisma = {
    membership: { findMany: vi.fn() },
    $transaction: vi.fn((work: (client: typeof tx) => Promise<unknown>) => work(tx)),
  };
  const users = { findById: vi.fn() };
  const passwords = { verify: vi.fn() };
  const sessions = { revokeAll: vi.fn() };
  const organizations = { afterMembershipRemoved: vi.fn() };
  const activity = { record: vi.fn() };
  const audit = { record: vi.fn() };
  const queue = { deleteStorageObjects: vi.fn() };
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    calls.length = 0;
    users.findById.mockResolvedValue({ ...user, avatarKey: 'avatars/user-1.png' });
    passwords.verify.mockResolvedValue(true);
    prisma.membership.findMany.mockResolvedValue([
      { id: 'm1', organizationId: 'org-1', role: 'MEMBER' },
    ]);
    service = new AuthService(
      prisma as unknown as PrismaService,
      users as unknown as UsersRepository,
      passwords as unknown as PasswordService,
      sessions as unknown as SessionsService,
      {} as TokenService,
      {} as UserTokensService,
      {} as LoginAttemptsService,
      {} as InvitationsService,
      organizations as unknown as OrganizationsService,
      activity as unknown as ActivityService,
      audit as unknown as AuditService,
      queue as unknown as QueueService,
      {} as AppConfig,
    );
  });

  it('refuses a wrong password', async () => {
    passwords.verify.mockResolvedValue(false);
    await expect(service.deleteAccount(user.id, 'nope')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuses while the user still owns an organization', async () => {
    prisma.membership.findMany.mockResolvedValue([
      { id: 'm1', organizationId: 'org-1', role: 'OWNER' },
    ]);
    await expect(service.deleteAccount(user.id, 'secret')).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('unassigns before removing memberships, anonymizes the row and revokes sessions', async () => {
    await service.deleteAccount(user.id, 'secret');

    expect(calls.indexOf('unassign tasks')).toBeLessThan(calls.indexOf('delete memberships'));
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: user.id },
        data: expect.objectContaining({
          email: tombstoneEmail(user.id),
          name: 'Deleted user',
          avatarKey: null,
          deletedAt: expect.any(Date) as Date,
        }),
      }),
    );
    expect(tombstoneEmail(user.id)).toBe(tombstoneEmail(user.id).toLowerCase());
    expect(audit.record).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ action: 'member.left', organizationId: 'org-1' }),
        expect.objectContaining({ action: 'user.deleted', organizationId: null }),
      ]),
      tx,
    );
    expect(sessions.revokeAll).toHaveBeenCalledWith(user.id);
    expect(queue.deleteStorageObjects).toHaveBeenCalledWith(['avatars/user-1.png']);
    expect(organizations.afterMembershipRemoved).toHaveBeenCalledWith('org-1', 'm1', user.id);
  });
});
