import { http } from '@/lib/http';
import type { Comment, CreateCommentInput, UpdateCommentInput } from '@/types';

export const commentsService = {
  list: async (taskId: string, signal?: AbortSignal): Promise<Comment[]> =>
    (await http.get<Comment[]>(`/tasks/${taskId}/comments`, { signal })).data,

  create: async (taskId: string, input: CreateCommentInput): Promise<Comment> =>
    (await http.post<Comment>(`/tasks/${taskId}/comments`, input)).data,

  update: async (commentId: string, input: UpdateCommentInput): Promise<Comment> =>
    (await http.patch<Comment>(`/comments/${commentId}`, input)).data,

  delete: async (commentId: string): Promise<void> => {
    await http.delete(`/comments/${commentId}`);
  },
};
