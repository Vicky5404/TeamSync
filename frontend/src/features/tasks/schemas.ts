import { z } from 'zod';

import { TASK_PRIORITIES, TASK_STATUSES } from '@/types';

export const taskTitleSchema = z
  .string()
  .trim()
  .min(1, 'Title is required')
  .max(200, 'Use at most 200 characters');

export const taskFormSchema = z.object({
  title: taskTitleSchema,
  description: z.string().trim().max(10_000, 'Description is too long'),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  /** Empty string = unassigned. */
  assigneeId: z.string(),
  /** Empty string = no due date; otherwise `YYYY-MM-DD`. */
  dueDate: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Enter a valid date'),
  labelIds: z.array(z.string()),
});

export type TaskFormValues = z.infer<typeof taskFormSchema>;
