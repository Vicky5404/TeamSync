import { create } from 'zustand';

export type AuthStatus = 'unknown' | 'authenticated' | 'unauthenticated';

interface AuthState {
  /**
   * Short-lived access token. Deliberately kept in memory only (never
   * persisted) — the session is restored on load via the httpOnly refresh cookie.
   */
  accessToken: string | null;
  status: AuthStatus;
  /** True when the session ended involuntarily (e.g. refresh token expired). */
  sessionExpired: boolean;
  /**
   * Why the session couldn't be restored on startup yet (API unreachable or
   * failing). The session is kept and restoring is retried automatically.
   */
  restoreError: string | null;
  setSession: (accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  clearSession: () => void;
  expireSession: () => void;
  acknowledgeSessionExpiry: () => void;
  setRestoreError: (message: string | null) => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  accessToken: null,
  status: 'unknown',
  sessionExpired: false,
  restoreError: null,
  setSession: (accessToken) =>
    set({ accessToken, status: 'authenticated', sessionExpired: false, restoreError: null }),
  setAccessToken: (accessToken) => set({ accessToken }),
  clearSession: () => set({ accessToken: null, status: 'unauthenticated', restoreError: null }),
  expireSession: () =>
    set((state) => ({
      accessToken: null,
      status: 'unauthenticated',
      sessionExpired: state.status === 'authenticated',
    })),
  acknowledgeSessionExpiry: () => set({ sessionExpired: false }),
  setRestoreError: (restoreError) => set({ restoreError }),
}));
