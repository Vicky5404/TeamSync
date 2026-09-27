import { MessageSquare } from 'lucide-react';

import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton';
import { useCurrentUser } from '@/features/auth/api/auth.queries';
import { usePermissions } from '@/features/organizations/active-organization';

import { useComments, useCreateComment } from '../api/comments.queries';
import { CommentComposer } from './CommentComposer';
import { CommentItem } from './CommentItem';

export function CommentsSection({ taskId }: { taskId: string }) {
  const comments = useComments(taskId);
  const create = useCreateComment(taskId);
  const { data: currentUser } = useCurrentUser();
  const { can, role } = usePermissions();
  const canComment = can('comments:create');

  return (
    <div className="space-y-5">
      {comments.isPending ? (
        <SkeletonGroup label="Loading comments" className="space-y-4">
          {[0, 1].map((row) => (
            <div key={row} className="flex gap-3">
              <Skeleton className="size-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          ))}
        </SkeletonGroup>
      ) : comments.isError ? (
        <ErrorState
          error={comments.error}
          onRetry={() => void comments.refetch()}
          retrying={comments.isFetching}
          size="sm"
        />
      ) : comments.data.length === 0 ? (
        <EmptyState
          icon={<MessageSquare />}
          title="No comments yet"
          description={canComment ? 'Start the conversation below.' : undefined}
          size="sm"
        />
      ) : (
        <ol className="space-y-5" aria-label="Comments">
          {comments.data.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              taskId={taskId}
              canModify={
                comment.author.id === currentUser?.id || role === 'OWNER' || role === 'ADMIN'
              }
            />
          ))}
        </ol>
      )}

      {canComment ? (
        <CommentComposer onSubmit={(body) => create.mutate(body)} isSubmitting={create.isPending} />
      ) : (
        <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-muted-foreground">
          You have read-only access and can&apos;t comment on tasks.
        </p>
      )}
    </div>
  );
}
