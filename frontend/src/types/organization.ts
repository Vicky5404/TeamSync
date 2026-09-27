import type { ISODateTime } from './api';
import type { ProjectStatus } from './project';
import type { UserSummary } from './user';

export const ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'] as const;
export type Role = (typeof ROLES)[number];

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  memberCount: number;
  createdAt: ISODateTime;
  /** The authenticated user's role within this organization. */
  role: Role;
}

export interface CreateOrganizationInput {
  name: string;
  slug: string;
}

export interface UpdateOrganizationInput {
  name?: string;
  slug?: string;
  description?: string | null;
}

export interface MemberUser extends UserSummary {
  jobTitle: string | null;
  timezone: string;
}

export interface Member {
  /** Membership id (not the user id). */
  id: string;
  user: MemberUser;
  role: Role;
  joinedAt: ISODateTime;
  lastActiveAt: ISODateTime | null;
}

export interface MemberListParams {
  search?: string;
  role?: Role;
}

export interface MemberProjectSummary {
  id: string;
  name: string;
  key: string;
  status: ProjectStatus;
  progress: number;
}

export interface MemberProfile extends Member {
  stats: {
    openTasks: number;
    completedTasks: number;
    overdueTasks: number;
    projects: number;
  };
  projects: MemberProjectSummary[];
}

export type InvitationStatus = 'PENDING' | 'EXPIRED';

export interface Invitation {
  id: string;
  email: string;
  role: Role;
  status: InvitationStatus;
  invitedBy: UserSummary;
  createdAt: ISODateTime;
  expiresAt: ISODateTime;
}

export interface InviteMembersInput {
  emails: string[];
  role: Role;
  message: string | null;
}

export interface InviteMembersResult {
  invited: Invitation[];
  skipped: Array<{ email: string; reason: string }>;
}
