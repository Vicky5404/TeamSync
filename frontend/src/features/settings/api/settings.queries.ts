import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { filesService, usersService } from '@/services';
import type { ChangePasswordInput, UpdateProfileInput, User, UserSession } from '@/types';

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => usersService.updateProfile(input),
    meta: { errorToast: false },
    onSuccess: (user) => queryClient.setQueryData<User>(queryKeys.auth.me(), user),
  });
}

export function useUploadAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => filesService.uploadAvatar(file),
    onSuccess: (user) => queryClient.setQueryData<User>(queryKeys.auth.me(), user),
  });
}

export function useRemoveAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => filesService.removeAvatar(),
    onSuccess: (user) => queryClient.setQueryData<User>(queryKeys.auth.me(), user),
  });
}

export function useChangePassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ChangePasswordInput) => usersService.changePassword(input),
    meta: { errorToast: false },
    // Changing the password signs out other sessions server-side.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.users.sessions() }),
  });
}

export function useSessions() {
  return useQuery({
    queryKey: queryKeys.users.sessions(),
    queryFn: ({ signal }) => usersService.listSessions(signal),
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => usersService.revokeSession(sessionId),
    onSuccess: (_result, sessionId) =>
      queryClient.setQueryData<UserSession[]>(queryKeys.users.sessions(), (sessions) =>
        sessions?.filter((session) => session.id !== sessionId),
      ),
  });
}

export function useRevokeOtherSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => usersService.revokeOtherSessions(),
    onSuccess: () =>
      queryClient.setQueryData<UserSession[]>(queryKeys.users.sessions(), (sessions) =>
        sessions?.filter((session) => session.current),
      ),
  });
}
