import { z } from 'zod';

import { passwordSchema } from '@/features/auth/schemas';

export const profileSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(80, 'Name is too long'),
  jobTitle: z.string().trim().max(80, 'Use at most 80 characters'),
  timezone: z.string().min(1, 'Choose a time zone'),
});
export type ProfileValues = z.infer<typeof profileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    error: "Passwords don't match",
  })
  .refine((values) => values.newPassword !== values.currentPassword, {
    path: ['newPassword'],
    error: 'Choose a password different from your current one',
  });
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
