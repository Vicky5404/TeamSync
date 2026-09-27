import type { ISODateTime } from './api';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  jobTitle: string | null;
  timezone: string;
  emailVerified: boolean;
  createdAt: ISODateTime;
}

/** Compact user representation embedded in other resources. */
export interface UserSummary {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface UpdateProfileInput {
  name: string;
  jobTitle: string | null;
  timezone: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface UserSession {
  id: string;
  device: string;
  browser: string;
  os: string;
  ipAddress: string;
  location: string | null;
  lastActiveAt: ISODateTime;
  createdAt: ISODateTime;
  current: boolean;
}
