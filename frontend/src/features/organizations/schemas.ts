import { z } from 'zod';

export const organizationNameSchema = z
  .string()
  .trim()
  .min(2, 'Use at least 2 characters')
  .max(64, 'Use at most 64 characters');

export const organizationSlugSchema = z
  .string()
  .trim()
  .min(2, 'Use at least 2 characters')
  .max(48, 'Use at most 48 characters')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single hyphens');

export const createOrganizationSchema = z.object({
  name: organizationNameSchema,
  slug: organizationSlugSchema,
});
export type CreateOrganizationValues = z.infer<typeof createOrganizationSchema>;

export const updateOrganizationSchema = z.object({
  name: organizationNameSchema,
  slug: organizationSlugSchema,
  description: z.string().trim().max(280, 'Use at most 280 characters'),
});
export type UpdateOrganizationValues = z.infer<typeof updateOrganizationSchema>;
