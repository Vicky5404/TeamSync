import type { AxiosProgressEvent } from 'axios';

import { http } from '@/lib/http';
import type { Attachment, UploadProgress, User } from '@/types';

export interface UploadOptions {
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
}

function toProgress(event: AxiosProgressEvent, fallbackTotal: number): UploadProgress {
  const total = event.total ?? fallbackTotal;
  return {
    loaded: event.loaded,
    total,
    percent: total > 0 ? Math.min(100, Math.round((event.loaded / total) * 100)) : 0,
  };
}

function toFormData(field: string, file: File): FormData {
  const formData = new FormData();
  formData.append(field, file, file.name);
  return formData;
}

export const filesService = {
  listAttachments: async (taskId: string, signal?: AbortSignal): Promise<Attachment[]> =>
    (await http.get<Attachment[]>(`/tasks/${taskId}/attachments`, { signal })).data,

  uploadAttachment: async (
    taskId: string,
    file: File,
    { onProgress, signal }: UploadOptions = {},
  ): Promise<Attachment> =>
    (
      await http.post<Attachment>(`/tasks/${taskId}/attachments`, toFormData('file', file), {
        signal,
        // Uploads can legitimately take longer than regular API calls.
        timeout: 0,
        onUploadProgress: onProgress
          ? (event) => onProgress(toProgress(event, file.size))
          : undefined,
      })
    ).data,

  /** Fresh short-lived download URL (the `url` in list responses expires after a few minutes). */
  getDownloadUrl: async (attachmentId: string): Promise<string> =>
    (await http.get<{ url: string }>(`/attachments/${attachmentId}/download`)).data.url,

  deleteAttachment: async (attachmentId: string): Promise<void> => {
    await http.delete(`/attachments/${attachmentId}`);
  },

  uploadAvatar: async (file: File, { onProgress, signal }: UploadOptions = {}): Promise<User> =>
    (
      await http.post<User>('/users/me/avatar', toFormData('avatar', file), {
        signal,
        timeout: 0,
        onUploadProgress: onProgress
          ? (event) => onProgress(toProgress(event, file.size))
          : undefined,
      })
    ).data,

  removeAvatar: async (): Promise<User> => (await http.delete<User>('/users/me/avatar')).data,
};
