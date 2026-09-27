import { EllipsisVertical, Pencil, Trash } from 'lucide-react';
import { useState } from 'react';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { cn } from '@/lib/cn';
import { toast } from '@/store/toast.store';
import type { Comment } from '@/types';
import { formatDateTime, formatRelativeTime } from '@/utils/date';

import { useDeleteComment, useUpdateComment } from '../api/comments.queries';
import { CommentComposer } from './CommentComposer';

interface CommentItemProps {
  comment: Comment;
  taskId: string;
  canModify: boolean;
}

export function CommentItem({ comment, taskId, canModify }: CommentItemProps) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const update = useUpdateComment(taskId);
  const remove = useDeleteComment(taskId);
  const pending = comment.id.startsWith('optimistic-');

  return (
    <li className={cn('flex gap-3', pending && 'opacity-60')}>
      <Avatar name={comment.author.name} src={comment.author.avatarUrl} size="md" decorative />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground">{comment.author.name}</p>
          <time
            dateTime={comment.createdAt}
            title={formatDateTime(comment.createdAt)}
            className="text-xs text-muted-foreground"
          >
            {pending ? 'Sending…' : formatRelativeTime(comment.createdAt)}
          </time>
          {comment.edited && <span className="text-xs text-muted-foreground">(edited)</span>}
          {canModify && !pending && !editing && (
            <Dropdown
              label="Comment actions"
              trigger={(props) => (
                <Button
                  {...props}
                  variant="ghost"
                  size="icon-xs"
                  className="ml-auto text-muted-foreground"
                  aria-label="Comment actions"
                >
                  <EllipsisVertical />
                </Button>
              )}
            >
              <DropdownItem icon={<Pencil />} onSelect={() => setEditing(true)}>
                Edit
              </DropdownItem>
              <DropdownItem icon={<Trash />} destructive onSelect={() => setConfirmDelete(true)}>
                Delete
              </DropdownItem>
            </Dropdown>
          )}
        </div>

        {editing ? (
          <div className="mt-2">
            <CommentComposer
              initialValue={comment.body}
              submitLabel="Save"
              autoFocus
              isSubmitting={update.isPending}
              onCancel={() => setEditing(false)}
              onSubmit={(body) =>
                update.mutate(
                  { commentId: comment.id, body },
                  { onSuccess: () => setEditing(false) },
                )
              }
            />
          </div>
        ) : (
          <p className="mt-1 text-sm break-words whitespace-pre-wrap text-foreground">
            {comment.body}
          </p>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete comment?"
        description="This comment will be permanently removed."
        confirmLabel="Delete comment"
        loading={remove.isPending}
        onConfirm={() =>
          remove.mutate(comment.id, {
            onSuccess: () => {
              setConfirmDelete(false);
              toast.success('Comment deleted');
            },
          })
        }
      />
    </li>
  );
}
