import type { AccessContext, RequestClient } from '../../common/auth/auth.types.js';

/**
 * Security and administration events. Unlike activity (the product's
 * collaboration feed), audit entries are immutable, carry request metadata and
 * are only readable by organization admins.
 */
export const AuditAction = {
  ORGANIZATION_UPDATED: 'organization.updated',
  ORGANIZATION_DELETED: 'organization.deleted',
  OWNERSHIP_TRANSFERRED: 'organization.ownership_transferred',
  MEMBER_INVITED: 'member.invited',
  INVITATION_RESENT: 'member.invitation_resent',
  INVITATION_REVOKED: 'member.invitation_revoked',
  MEMBER_JOINED: 'member.joined',
  MEMBER_ROLE_CHANGED: 'member.role_changed',
  MEMBER_REMOVED: 'member.removed',
  MEMBER_LEFT: 'member.left',
  PROJECT_DELETED: 'project.deleted',
  PROJECT_RESTORED: 'project.restored',
  TASK_DELETED: 'task.deleted',
  TASK_RESTORED: 'task.restored',
  COMMENT_MODERATED: 'comment.moderated',
  PASSWORD_CHANGED: 'user.password_changed',
  PASSWORD_RESET: 'user.password_reset',
  ACCOUNT_DELETED: 'user.deleted',
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export type AuditEntityType =
  'organization' | 'member' | 'invitation' | 'project' | 'task' | 'comment' | 'user';

export type AuditMetadata = Record<string, string | number | boolean | null>;

export interface AuditEntry {
  /** Null for account-level and platform events (e.g. a deleted organization). */
  organizationId: string | null;
  actorId: string | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string | null;
  metadata?: AuditMetadata;
  client?: RequestClient | null;
}

/** Organization, actor and request metadata of an organization-scoped request. */
export function auditBase(
  access: AccessContext,
): Pick<AuditEntry, 'organizationId' | 'actorId' | 'client'> {
  return {
    organizationId: access.organizationId,
    actorId: access.userId,
    client: access.client ?? null,
  };
}
