import { http } from '@/lib/http';
import type { ChangePasswordInput, UpdateProfileInput, User, UserSession } from '@/types';

export const usersService = {
  updateProfile: async (input: UpdateProfileInput): Promise<User> =>
    (await http.patch<User>('/users/me', input)).data,

  changePassword: async (input: ChangePasswordInput): Promise<void> => {
    await http.post('/users/me/password', input);
  },

  listSessions: async (signal?: AbortSignal): Promise<UserSession[]> =>
    (await http.get<UserSession[]>('/users/me/sessions', { signal })).data,

  revokeSession: async (sessionId: string): Promise<void> => {
    await http.delete(`/users/me/sessions/${sessionId}`);
  },

  revokeOtherSessions: async (): Promise<void> => {
    await http.delete('/users/me/sessions', { params: { scope: 'others' } });
  },
};
