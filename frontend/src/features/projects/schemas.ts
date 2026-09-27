import { z } from 'zod';

import { PROJECT_STATUSES } from '@/types';

const optionalDate = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Enter a valid date');

export const projectFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Use at least 2 characters')
      .max(80, 'Use at most 80 characters'),
    key: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z][A-Z0-9]{1,5}$/, '2–6 characters: letters and numbers, starting with a letter'),
    description: z.string().trim().max(2000, 'Use at most 2000 characters'),
    status: z.enum(PROJECT_STATUSES),
    startDate: optionalDate,
    dueDate: optionalDate,
    memberIds: z.array(z.string()),
  })
  .refine((values) => !values.startDate || !values.dueDate || values.startDate <= values.dueDate, {
    path: ['dueDate'],
    error: 'The due date must be on or after the start date',
  });

export type ProjectFormValues = z.infer<typeof projectFormSchema>;
