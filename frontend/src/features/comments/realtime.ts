import type { RealtimeRegistration } from '@/lib/realtime/RealtimeProvider';
import { queryKeys } from '@/lib/query-keys';
import type { Comment } from '@/types';

import { upsertComment } from './api/comments.queries';

/**
 * Append teammates' comments to open threads without refetching. Comment
 * counters on task cards arrive separately via `task.updated`.
 */
export const registerCommentRealtime: RealtimeRegistration = (client, queryClient) =>
  client.on('comment.created', (comment) => {
    queryClient.setQueryData<Comment[]>(queryKeys.comments.list(comment.taskId), (comments) =>
      upsertComment(comments, comment),
    );
    void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.activity(comment.taskId) });
  });
