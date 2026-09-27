import { z } from 'zod';

import { ROLES } from '@/types';

const EMAIL = z.email();
const MAX_INVITES = 20;

/** Split on commas, semicolons, whitespace and newlines. */
export function parseEmailList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\s,;]+/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

export const inviteSchema = z.object({
  emails: z.string().superRefine((value, context) => {
    const emails = parseEmailList(value);
    if (emails.length === 0) {
      context.addIssue({ code: 'custom', message: 'Enter at least one email address' });
      return;
    }
    if (emails.length > MAX_INVITES) {
      context.addIssue({ code: 'custom', message: `Invite at most ${MAX_INVITES} people at once` });
      return;
    }
    const invalid = emails.filter((email) => !EMAIL.safeParse(email).success);
    if (invalid.length > 0) {
      context.addIssue({
        code: 'custom',
        message: `Invalid email: ${invalid.slice(0, 3).join(', ')}`,
      });
    }
  }),
  role: z.enum(ROLES),
  message: z.string().trim().max(500, 'Use at most 500 characters'),
});

export type InviteValues = z.infer<typeof inviteSchema>;
