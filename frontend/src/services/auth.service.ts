import { http, refreshSession } from '@/lib/http';
import type {
  AuthSession,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  RegisterResult,
  ResetPasswordInput,
  User,
  VerifyEmailInput,
} from '@/types';

/** Public endpoints must never trigger the 401 → refresh flow. */
const PUBLIC = { skipAuth: true, skipAuthRefresh: true } as const;

export const authService = {
  login: async (input: LoginInput): Promise<AuthSession> =>
    (await http.post<AuthSession>('/auth/login', input, PUBLIC)).data,

  register: async (input: RegisterInput): Promise<RegisterResult> =>
    (await http.post<RegisterResult>('/auth/register', input, PUBLIC)).data,

  /** Revokes the refresh token server-side and clears the cookie. */
  logout: async (): Promise<void> => {
    await http.post('/auth/logout', undefined, { skipAuthRefresh: true });
  },

  /** Restores a session from the httpOnly refresh cookie. */
  refresh: (): Promise<AuthSession> => refreshSession(),

  me: async (signal?: AbortSignal): Promise<User> =>
    (await http.get<User>('/auth/me', { signal })).data,

  forgotPassword: async (input: ForgotPasswordInput): Promise<void> => {
    await http.post('/auth/forgot-password', input, PUBLIC);
  },

  resetPassword: async (input: ResetPasswordInput): Promise<void> => {
    await http.post('/auth/reset-password', input, PUBLIC);
  },

  verifyEmail: async (input: VerifyEmailInput): Promise<void> => {
    await http.post('/auth/verify-email', input, PUBLIC);
  },

  resendVerification: async (email: string): Promise<void> => {
    await http.post('/auth/resend-verification', { email }, PUBLIC);
  },
};
