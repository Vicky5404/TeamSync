import { Injectable, Logger } from '@nestjs/common';

import type { RequestClient } from '../../common/auth/auth.types.js';
import { ErrorCode, Errors } from '../../common/errors/api-exception.js';
import { isUniqueViolation } from '../../common/errors/prisma-errors.js';
import { AppConfig } from '../../config/app-config.js';
import { Prisma, type User } from '../../generated/prisma/client.js';
import { Role, UserTokenType } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { QueueService } from '../../infrastructure/queue/queue.service.js';
import { ActivityService } from '../activity/activity.service.js';
import { ActivityAction } from '../activity/activity.types.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../audit/audit.types.js';
import { InvitationsService } from '../organizations/invitations.service.js';
import { OrganizationsService } from '../organizations/organizations.service.js';
import { toUserDto, type UserDto } from '../users/dto/user.dto.js';
import { UsersRepository } from '../users/users.repository.js';

import type {
  AuthSessionDto,
  ChangePasswordDto,
  LoginDto,
  RegisterDto,
  RegisterResultDto,
  ResetPasswordDto,
} from './dto/auth.dto.js';
import { LoginAttemptsService } from './login-attempts.service.js';
import { PasswordService } from './password.service.js';
import { type ClientContext, SessionsService } from './sessions.service.js';
import { TokenService } from './token.service.js';
import { UserTokensService } from './user-tokens.service.js';

/** Stored in place of a deleted account's password hash; no password ever matches it. */
const DELETED_PASSWORD_HASH = '!deleted';
const DELETED_USER_NAME = 'Deleted user';

/** Unique, lower-case, undeliverable (RFC 2606 `.invalid`) address for a deleted account. */
export const tombstoneEmail = (userId: string) => `deleted+${userId}@deleted.invalid`;

export interface SignedInSession {
  body: AuthSessionDto;
  refreshToken: string;
  /** Persistent cookie lifetime; undefined → browser-session cookie. */
  cookieMaxAgeMs: number | undefined;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersRepository,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionsService,
    private readonly tokens: TokenService,
    private readonly userTokens: UserTokensService,
    private readonly loginAttempts: LoginAttemptsService,
    private readonly invitations: InvitationsService,
    private readonly organizations: OrganizationsService,
    private readonly activity: ActivityService,
    private readonly audit: AuditService,
    private readonly queue: QueueService,
    private readonly config: AppConfig,
  ) {}

  async register(input: RegisterDto): Promise<RegisterResultDto> {
    const requiresEmailVerification = this.config.auth.requireEmailVerification;
    const conflict = () =>
      Errors.conflict('An account with this email already exists.', {
        email: ['An account with this email already exists'],
      });

    if (await this.users.findByEmail(input.email)) throw conflict();
    let user: User;
    try {
      user = await this.users.create({
        name: input.name,
        email: input.email,
        passwordHash: await this.passwords.hash(input.password),
        emailVerifiedAt: requiresEmailVerification ? null : new Date(),
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict();
      throw error;
    }

    if (requiresEmailVerification) {
      await this.sendVerificationEmail(user);
    } else {
      await this.invitations.acceptPendingForUser(user);
    }
    return { email: user.email, requiresEmailVerification };
  }

  async login(input: LoginDto, client: ClientContext): Promise<SignedInSession> {
    const lockedFor = await this.loginAttempts.lockedFor(input.email);
    if (lockedFor > 0) {
      throw Errors.tooManyRequests(
        `Too many failed sign-in attempts. Try again in ${Math.ceil(lockedFor / 60)} minute(s).`,
        ErrorCode.ACCOUNT_LOCKED,
      );
    }

    const user = await this.users.findByEmail(input.email);
    const valid = user
      ? await this.passwords.verify(user.passwordHash, input.password)
      : (await this.passwords.verifyDummy(input.password), false);
    if (!user || !valid) {
      await this.loginAttempts.recordFailure(input.email);
      throw Errors.unauthorized('Incorrect email or password.', ErrorCode.INVALID_CREDENTIALS);
    }
    await this.loginAttempts.reset(input.email);

    if (this.config.auth.requireEmailVerification && !user.emailVerifiedAt) {
      throw Errors.forbidden(
        'Please verify your email address before signing in.',
        ErrorCode.EMAIL_NOT_VERIFIED,
      );
    }

    if (this.passwords.needsRehash(user.passwordHash)) {
      await this.users.update(user.id, { passwordHash: await this.passwords.hash(input.password) });
    }

    const rememberMe = input.rememberMe ?? false;
    const { session, refreshToken } = await this.sessions.create(user.id, rememberMe, client);
    this.logger.log({ userId: user.id, sessionId: session.id }, 'User signed in');
    return this.signedIn(user, session.id, refreshToken, rememberMe);
  }

  async refresh(refreshToken: string | undefined, client: ClientContext): Promise<SignedInSession> {
    if (!refreshToken) throw Errors.unauthorized('No active session.');
    const { session, refreshToken: rotated } = await this.sessions.rotate(refreshToken, client);
    // Deleted accounts resolve to null (their sessions are revoked as well).
    const user = await this.users.findById(session.userId);
    if (!user) throw Errors.unauthorized('No active session.');
    return this.signedIn(user, session.id, rotated, session.rememberMe);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    const sessionId = await this.sessions.revokeByToken(refreshToken);
    if (sessionId) this.logger.log({ sessionId }, 'User signed out');
  }

  async me(userId: string): Promise<UserDto> {
    const user = await this.users.findById(userId);
    if (!user) throw Errors.unauthorized();
    return toUserDto(user);
  }

  /** Always succeeds so the endpoint can't be used to discover accounts. */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user) return;
    const token = await this.userTokens.issue(user.id, UserTokenType.PASSWORD_RESET);
    await this.queue.sendEmail({
      to: user.email,
      template: 'reset-password',
      data: { name: user.name, link: this.config.appLink('/reset-password', { token }) },
    });
  }

  async resetPassword(input: ResetPasswordDto, client: RequestClient | null = null): Promise<void> {
    const passwordHash = await this.passwords.hash(input.password);
    const userId = await this.prisma.$transaction(async (tx) => {
      const token = await this.userTokens.consume(input.token, UserTokenType.PASSWORD_RESET, tx);
      if (!token) return null;
      const user = await tx.user.findUniqueOrThrow({ where: { id: token.userId } });
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          passwordChangedAt: new Date(),
          // Receiving the reset link proves control of the address.
          ...(user.emailVerifiedAt ? {} : { emailVerifiedAt: new Date() }),
        },
      });
      await this.audit.record(
        {
          organizationId: null,
          actorId: user.id,
          action: AuditAction.PASSWORD_RESET,
          entityType: 'user',
          entityId: user.id,
          client,
        },
        tx,
      );
      return user.id;
    });
    if (!userId)
      throw Errors.badRequest(
        'This reset link is invalid or has expired.',
        ErrorCode.INVALID_TOKEN,
      );
    await this.sessions.revokeAll(userId);
    this.logger.log({ userId }, 'Password reset; all sessions revoked');
  }

  async verifyEmail(token: string): Promise<void> {
    const user = await this.prisma.$transaction(async (tx) => {
      const record = await this.userTokens.consume(token, UserTokenType.EMAIL_VERIFICATION, tx);
      if (!record) return null;
      return tx.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      });
    });
    if (!user)
      throw Errors.badRequest(
        'This verification link is invalid or has expired.',
        ErrorCode.INVALID_TOKEN,
      );
    await this.invitations.acceptPendingForUser(user);
  }

  /** Always succeeds (no account discovery). */
  async resendVerification(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (user && !user.emailVerifiedAt) await this.sendVerificationEmail(user);
  }

  async changePassword(
    userId: string,
    sessionId: string,
    input: ChangePasswordDto,
    client: RequestClient | null = null,
  ): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) throw Errors.unauthorized();
    if (!(await this.passwords.verify(user.passwordHash, input.currentPassword))) {
      throw Errors.validation({ currentPassword: ['Your current password is incorrect'] });
    }
    // Hash before opening the transaction: Argon2 is deliberately slow.
    const passwordHash = await this.passwords.hash(input.newPassword);
    await this.prisma.$transaction(async (tx) => {
      await this.users.update(userId, { passwordHash, passwordChangedAt: new Date() }, tx);
      await this.audit.record(
        {
          organizationId: null,
          actorId: userId,
          action: AuditAction.PASSWORD_CHANGED,
          entityType: 'user',
          entityId: userId,
          client,
        },
        tx,
      );
    });
    // Keep the current device signed in; sign out everywhere else.
    await this.sessions.revokeOthers(userId, sessionId);
  }

  /**
   * Delete the signed-in user's account (password confirmation required).
   *
   * The user row is soft-deleted and anonymized rather than removed, so the
   * comments, tasks and history they authored stay intact and show "Deleted
   * user". Everything personal goes: memberships (and with them project
   * memberships and task assignments), notifications, pending tokens, the
   * avatar and every session. The email is replaced by a tombstone, so the
   * address can sign up again. Owners must hand over their organizations first.
   */
  async deleteAccount(
    userId: string,
    password: string,
    client: RequestClient | null = null,
  ): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) throw Errors.unauthorized();
    if (!(await this.passwords.verify(user.passwordHash, password))) {
      throw Errors.validation({ password: ['Your password is incorrect'] });
    }
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      select: { id: true, organizationId: true, role: true },
    });
    if (memberships.some((membership) => membership.role === Role.OWNER)) {
      throw Errors.conflict(
        'You own an organization. Transfer ownership or delete it before deleting your account.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Unassign first: the database rejects removing a membership that tasks still reference.
      await tx.task.updateMany({ where: { assigneeId: userId }, data: { assigneeId: null } });
      await tx.membership.deleteMany({ where: { userId } });
      await tx.notification.deleteMany({ where: { userId } });
      await tx.userToken.deleteMany({ where: { userId } });
      await tx.user.update({
        where: { id: userId },
        data: {
          deletedAt: new Date(),
          email: tombstoneEmail(userId),
          name: DELETED_USER_NAME,
          passwordHash: DELETED_PASSWORD_HASH,
          jobTitle: null,
          avatarKey: null,
          avatarUrl: null,
          emailVerifiedAt: null,
          notificationPreferences: Prisma.DbNull,
        },
      });
      await this.activity.record(
        memberships.map((membership) => ({
          organizationId: membership.organizationId,
          actorId: userId,
          action: ActivityAction.MEMBER_LEFT,
          target: {
            type: 'organization' as const,
            id: membership.organizationId,
            name: DELETED_USER_NAME,
          },
        })),
        tx,
      );
      await this.audit.record(
        [
          ...memberships.map((membership) => ({
            organizationId: membership.organizationId,
            actorId: userId,
            action: AuditAction.MEMBER_LEFT,
            entityType: 'member' as const,
            entityId: membership.id,
            metadata: { userId, role: membership.role, reason: 'account_deleted' },
            client,
          })),
          {
            organizationId: null,
            actorId: userId,
            action: AuditAction.ACCOUNT_DELETED,
            entityType: 'user' as const,
            entityId: userId,
            metadata: { organizations: memberships.length },
            client,
          },
        ],
        tx,
      );
    });

    await this.sessions.revokeAll(userId);
    if (user.avatarKey) await this.queue.deleteStorageObjects([user.avatarKey]);
    for (const membership of memberships) {
      await this.organizations.afterMembershipRemoved(
        membership.organizationId,
        membership.id,
        userId,
      );
    }
    this.logger.log({ userId }, 'Account deleted');
  }

  private async sendVerificationEmail(user: User): Promise<void> {
    const token = await this.userTokens.issue(user.id, UserTokenType.EMAIL_VERIFICATION);
    await this.queue.sendEmail({
      to: user.email,
      template: 'verify-email',
      data: { name: user.name, link: this.config.appLink('/verify-email', { token }) },
    });
  }

  private async signedIn(
    user: User,
    sessionId: string,
    refreshToken: string,
    rememberMe: boolean,
  ): Promise<SignedInSession> {
    const { accessToken, expiresIn } = await this.tokens.issueAccessToken(user.id, sessionId);
    return {
      body: { accessToken, expiresIn, user: toUserDto(user) },
      refreshToken,
      cookieMaxAgeMs: rememberMe ? this.sessions.ttlMs(true) : undefined,
    };
  }
}
