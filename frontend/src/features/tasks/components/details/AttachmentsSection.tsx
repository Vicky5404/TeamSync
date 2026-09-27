import {
  CircleAlert,
  File,
  FileImage,
  FileText,
  Paperclip,
  RotateCw,
  Trash,
  Upload,
  X,
} from 'lucide-react';
import { useRef, useState, type DragEvent, type MouseEvent } from 'react';

import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorState } from '@/components/ui/ErrorState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { ApiError, ERROR_CODES, getErrorMessage } from '@/lib/http';
import { ATTACHMENT_ACCEPT, validateAttachment } from '@/lib/uploads';
import { toast } from '@/store/toast.store';
import type { Attachment } from '@/types';
import { formatRelativeTime } from '@/utils/date';
import { formatFileSize } from '@/utils/format';

import {
  useAttachments,
  useDeleteAttachment,
  useDownloadAttachment,
  useUploadAttachment,
} from '../../api/attachments.queries';

interface UploadEntry {
  id: string;
  file: File;
  percent: number;
  /** `rejected`: failed client-side validation (retrying won't help). */
  state: 'uploading' | 'failed' | 'rejected';
  error?: string;
  controller: AbortController;
}

function iconFor(mimeType: string) {
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType.startsWith('text/') || mimeType.includes('pdf') || mimeType.includes('json')) {
    return FileText;
  }
  return File;
}

interface AttachmentsSectionProps {
  taskId: string;
  canEdit: boolean;
}

export function AttachmentsSection({ taskId, canEdit }: AttachmentsSectionProps) {
  const attachments = useAttachments(taskId);
  const upload = useUploadAttachment(taskId);
  const remove = useDeleteAttachment(taskId);
  const download = useDownloadAttachment();
  const inputRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [toDelete, setToDelete] = useState<Attachment | null>(null);

  const patchEntry = (id: string, patch: Partial<UploadEntry>) =>
    setEntries((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  const dismissEntry = (id: string) =>
    setEntries((current) => current.filter((item) => item.id !== id));

  const uploadFile = (file: File, replaceId?: string) => {
    const entry: UploadEntry = {
      id: replaceId ?? crypto.randomUUID(),
      file,
      percent: 0,
      state: 'uploading',
      controller: new AbortController(),
    };
    const invalid = validateAttachment(file);
    if (invalid) {
      entry.state = 'rejected';
      entry.error = invalid;
    }
    setEntries((current) =>
      replaceId
        ? current.map((item) => (item.id === replaceId ? entry : item))
        : [...current, entry],
    );
    if (invalid) return;

    // mutateAsync: per-call handlers must run for every concurrent upload.
    upload
      .mutateAsync({
        file,
        signal: entry.controller.signal,
        onProgress: ({ percent }) => patchEntry(entry.id, { percent }),
      })
      .then(() => {
        dismissEntry(entry.id);
        toast.success(`${file.name} uploaded`);
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.code === ERROR_CODES.CANCELED) {
          dismissEntry(entry.id);
          return;
        }
        patchEntry(entry.id, { state: 'failed', error: getErrorMessage(error) });
      });
  };

  const uploadFiles = (files: FileList | File[]) => {
    for (const file of Array.from(files)) uploadFile(file);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    if (canEdit && event.dataTransfer.files.length) uploadFiles(event.dataTransfer.files);
  };

  // Presigned URLs in the list expire; fetch a fresh one when the user downloads.
  const onDownload = (event: MouseEvent<HTMLAnchorElement>, attachment: Attachment) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    download.mutate(attachment.id, {
      onSuccess: (url) => window.location.assign(url),
    });
  };

  const items = attachments.data ?? [];

  return (
    <div
      onDragOver={(event) => {
        if (!canEdit) return;
        event.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={onDrop}
      className={cn(
        'space-y-2 rounded-lg transition-colors',
        dragActive &&
          'bg-primary-soft/40 outline-2 outline-offset-4 outline-primary/40 outline-dashed',
      )}
    >
      {attachments.isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
        </div>
      ) : attachments.isError ? (
        <ErrorState
          error={attachments.error}
          onRetry={() => void attachments.refetch()}
          size="sm"
        />
      ) : (
        <ul className="space-y-1.5">
          {items.map((attachment) => {
            const Icon = iconFor(attachment.mimeType);
            return (
              <li
                key={attachment.id}
                className="flex items-center gap-3 rounded-lg border bg-surface px-3 py-2"
              >
                <Icon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={attachment.fileName}
                    onClick={(event) => onDownload(event, attachment)}
                    aria-busy={
                      download.isPending && download.variables === attachment.id ? true : undefined
                    }
                    className="block truncate text-sm font-medium text-foreground hover:underline"
                  >
                    {attachment.fileName}
                  </a>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(attachment.size)} · {attachment.uploadedBy.name} ·{' '}
                    {formatRelativeTime(attachment.createdAt)}
                  </p>
                </div>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Delete ${attachment.fileName}`}
                    onClick={() => setToDelete(attachment)}
                    className="text-muted-foreground"
                  >
                    <Trash />
                  </Button>
                )}
              </li>
            );
          })}
          {entries.map((item) =>
            item.state === 'uploading' ? (
              <li key={item.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                <Upload aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="flex justify-between gap-2 text-sm">
                    <span className="truncate">{item.file.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {item.percent < 100 ? `${item.percent}%` : 'Processing…'}
                    </span>
                  </p>
                  <ProgressBar value={item.percent} label={`Uploading ${item.file.name}`} />
                </div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Cancel upload of ${item.file.name}`}
                  onClick={() => item.controller.abort()}
                >
                  <X />
                </Button>
              </li>
            ) : (
              <li
                key={item.id}
                role="alert"
                className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive-soft px-3 py-2"
              >
                <CircleAlert aria-hidden="true" className="size-5 shrink-0 text-destructive" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.file.name}</p>
                  <p className="text-xs text-destructive-soft-foreground">
                    {item.state === 'rejected' ? 'Not uploaded: ' : 'Upload failed: '}
                    {item.error}
                  </p>
                </div>
                {item.state === 'failed' && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Retry upload of ${item.file.name}`}
                    onClick={() => uploadFile(item.file, item.id)}
                  >
                    <RotateCw />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Dismiss ${item.file.name}`}
                  onClick={() => dismissEntry(item.id)}
                >
                  <X />
                </Button>
              </li>
            ),
          )}
          {items.length === 0 && entries.length === 0 && (
            <li className="flex items-center gap-2 text-sm text-muted-foreground">
              <Paperclip aria-hidden="true" className="size-4" />
              {canEdit ? 'No files yet. Drop files here or upload.' : 'No attachments.'}
            </li>
          )}
        </ul>
      )}

      {canEdit && (
        <>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ATTACHMENT_ACCEPT}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              if (event.target.files) uploadFiles(event.target.files);
              event.target.value = '';
            }}
          />
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Upload />}
            onClick={() => inputRef.current?.click()}
          >
            Upload files
          </Button>
        </>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="Delete attachment?"
        description={
          toDelete
            ? `“${toDelete.fileName}” will be permanently removed from this task.`
            : undefined
        }
        confirmLabel="Delete file"
        loading={remove.isPending}
        onConfirm={() => {
          if (!toDelete) return;
          remove.mutate(toDelete.id, {
            onSuccess: () => {
              toast.success('Attachment deleted');
              setToDelete(null);
            },
          });
        }}
      />
    </div>
  );
}
