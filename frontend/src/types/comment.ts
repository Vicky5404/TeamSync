import type { ISODateTime } from './api';
import type { UserSummary } from './user';

export interface Comment {
  id: string;
  taskId: string;
  author: UserSummary;
  body: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  edited: boolean;
}

export interface CreateCommentInput {
  body: string;
}

export interface UpdateCommentInput {
  body: string;
}
