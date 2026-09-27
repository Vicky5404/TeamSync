import type { ISODateTime } from './api';
import type { UserSummary } from './user';

export interface Attachment {
  id: string;
  taskId: string;
  fileName: string;
  mimeType: string;
  /** Size in bytes. */
  size: number;
  url: string;
  uploadedBy: UserSummary;
  createdAt: ISODateTime;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}
