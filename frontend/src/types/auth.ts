import type { User } from './user';

export interface LoginInput {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

/**
 * Returned by login/refresh. The refresh token is never exposed to JS: the API
 * sets it as an httpOnly, Secure, SameSite cookie scoped to `/auth`.
 */
export interface AuthSession {
  accessToken: string;
  /** Access-token lifetime in seconds. */
  expiresIn: number;
  user: User;
}

export interface RegisterResult {
  email: string;
  requiresEmailVerification: boolean;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  token: string;
  password: string;
}

export interface VerifyEmailInput {
  token: string;
}
