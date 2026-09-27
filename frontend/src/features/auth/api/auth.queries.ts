import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { authService } from '@/services';
import { useAuthStore } from '@/store/auth.store';
import type { LoginInput, RegisterInput, ResetPasswordInput } from '@/types';

/** Profile of the signed-in user (seeded from the login/refresh response). */
export function useCurrentUser() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  return useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: ({ signal }) => authService.me(signal),
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  const setSession = useAuthStore((state) => state.setSession);
  return useMutation({
    mutationFn: (input: LoginInput) => authService.login(input),
    meta: { errorToast: false },
    onSuccess: (session) => {
      queryClient.setQueryData(queryKeys.auth.me(), session.user);
      setSession(session.accessToken);
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (input: RegisterInput) => authService.register(input),
    meta: { errorToast: false },
  });
}

/**
 * Ends the session. Cached server state is dropped by `SessionManager` and the
 * route guards redirect to the login page.
 */
export function useLogout() {
  const clearSession = useAuthStore((state) => state.clearSession);
  return useMutation({
    mutationFn: () => authService.logout(),
    meta: { errorToast: false },
    // Always end the local session, even if the server call fails.
    onSettled: () => clearSession(),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => authService.forgotPassword({ email }),
    meta: { errorToast: false },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (input: ResetPasswordInput) => authService.resetPassword(input),
    meta: { errorToast: false },
  });
}

export function useVerifyEmail() {
  return useMutation({
    mutationFn: (token: string) => authService.verifyEmail({ token }),
    meta: { errorToast: false },
  });
}

export function useResendVerification() {
  return useMutation({
    mutationFn: (email: string) => authService.resendVerification(email),
  });
}
