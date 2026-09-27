import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useCurrentUser } from '@/features/auth/api/auth.queries';
import { useTaskCounterUpdater } from '@/features/tasks/api/tasks.queries';
import { queryKeys } from '@/lib/query-keys';
import { commentsService } from '@/services';
import type { Comment } from '@/types';

const OPTIMISTIC_PREFIX = 'optimistic-';

/**
 * Insert a server comment into a cached thread exactly once. It replaces the
 * matching optimistic entry (by id, or by author + body for a real-time echo
 * that arrives before the HTTP response) instead of duplicating it.
 */
export function upsertComment(
  comments: Comment[] | undefined,
  comment: Comment,
  optimisticId?: string,
): Comment[] | undefined {
  if (!comments) return comments;
  const rest = comments.filter((item) => item.id !== comment.id);
  const index = rest.findIndex((item) =>
    optimisticId
      ? item.id === optimisticId
      : item.id.startsWith(OPTIMISTIC_PREFIX) &&
        item.author.id === comment.author.id &&
        item.body === comment.body,
  );
  if (index === -1) {
    // Already present (echo won the race) or a comment from someone else.
    return rest.length === comments.length ? [...rest, comment] : comments;
  }
  return rest.map((item, position) => (position === index ? comment : item));
}

export function useComments(taskId: string) {
  return useQuery({
    queryKey: queryKeys.comments.list(taskId),
    queryFn: ({ signal }) => commentsService.list(taskId, signal),
  });
}

/** Posts a comment with an optimistic entry that is replaced by the server copy. */
export function useCreateComment(taskId: string) {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const updateCounter = useTaskCounterUpdater();
  const key = queryKeys.comments.list(taskId);

  return useMutation({
    mutationFn: (body: string) => commentsService.create(taskId, { body }),
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Comment[]>(key);
      const optimisticId = `${OPTIMISTIC_PREFIX}${crypto.randomUUID()}`;
      if (currentUser) {
        const now = new Date().toISOString();
        const optimistic: Comment = {
          id: optimisticId,
          taskId,
          author: {
            id: currentUser.id,
            name: currentUser.name,
            email: currentUser.email,
            avatarUrl: currentUser.avatarUrl,
          },
          body,
          createdAt: now,
          updatedAt: now,
          edited: false,
        };
        queryClient.setQueryData<Comment[]>(key, (comments) => [...(comments ?? []), optimistic]);
      }
      updateCounter(taskId, 'commentCount', 1);
      return { previous, optimisticId };
    },
    onError: (_error, _body, context) => {
      queryClient.setQueryData(key, context?.previous);
      updateCounter(taskId, 'commentCount', -1);
    },
    onSuccess: (comment, _body, context) => {
      queryClient.setQueryData<Comment[]>(key, (comments) =>
        upsertComment(comments, comment, context.optimisticId),
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.activity(taskId) });
    },
  });
}

export function useUpdateComment(taskId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.comments.list(taskId);
  return useMutation({
    mutationFn: ({ commentId, body }: { commentId: string; body: string }) =>
      commentsService.update(commentId, { body }),
    onSuccess: (comment) =>
      queryClient.setQueryData<Comment[]>(key, (comments) =>
        comments?.map((item) => (item.id === comment.id ? comment : item)),
      ),
  });
}

export function useDeleteComment(taskId: string) {
  const queryClient = useQueryClient();
  const updateCounter = useTaskCounterUpdater();
  const key = queryKeys.comments.list(taskId);
  return useMutation({
    mutationFn: (commentId: string) => commentsService.delete(commentId),
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Comment[]>(key);
      queryClient.setQueryData<Comment[]>(key, (comments) =>
        comments?.filter((item) => item.id !== commentId),
      );
      updateCounter(taskId, 'commentCount', -1);
      return { previous };
    },
    onError: (_error, _commentId, context) => {
      queryClient.setQueryData(key, context?.previous);
      updateCounter(taskId, 'commentCount', 1);
    },
  });
}
