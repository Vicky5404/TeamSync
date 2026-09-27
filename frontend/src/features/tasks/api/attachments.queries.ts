import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { filesService } from '@/services';
import type { Attachment, UploadProgress } from '@/types';

import { useTaskCounterUpdater } from './tasks.queries';

export function useAttachments(taskId: string) {
  return useQuery({
    queryKey: queryKeys.attachments.list(taskId),
    queryFn: ({ signal }) => filesService.listAttachments(taskId, signal),
  });
}

interface UploadVariables {
  file: File;
  onProgress: (progress: UploadProgress) => void;
  signal: AbortSignal;
}

/** Callers report failures per file (no global toast). */
export function useUploadAttachment(taskId: string) {
  const queryClient = useQueryClient();
  const updateCounter = useTaskCounterUpdater();
  return useMutation({
    mutationFn: ({ file, onProgress, signal }: UploadVariables) =>
      filesService.uploadAttachment(taskId, file, { onProgress, signal }),
    meta: { errorToast: false },
    onMutate: () => updateCounter(taskId, 'attachmentCount', 1),
    onError: () => updateCounter(taskId, 'attachmentCount', -1),
    onSuccess: (attachment) => {
      queryClient.setQueryData<Attachment[]>(queryKeys.attachments.list(taskId), (items) => [
        attachment,
        ...(items ?? []).filter((item) => item.id !== attachment.id),
      ]);
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.activity(taskId) });
    },
  });
}

export function useDeleteAttachment(taskId: string) {
  const queryClient = useQueryClient();
  const updateCounter = useTaskCounterUpdater();
  return useMutation({
    mutationFn: (attachmentId: string) => filesService.deleteAttachment(attachmentId),
    onMutate: () => updateCounter(taskId, 'attachmentCount', -1),
    onError: () => updateCounter(taskId, 'attachmentCount', 1),
    onSuccess: (_result, attachmentId) => {
      queryClient.setQueryData<Attachment[]>(queryKeys.attachments.list(taskId), (items) =>
        items?.filter((item) => item.id !== attachmentId),
      );
    },
  });
}

/** Resolves a fresh download URL right before downloading (presigned URLs expire). */
export function useDownloadAttachment() {
  return useMutation({
    mutationFn: (attachmentId: string) => filesService.getDownloadUrl(attachmentId),
  });
}
