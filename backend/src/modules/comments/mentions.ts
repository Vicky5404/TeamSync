const EMAIL_MENTION = /(?:^|[\s(])@([^\s@()]+@[^\s@()]+\.[A-Za-z]{2,})/g;

/** Email addresses mentioned as `@someone@example.com` in a comment body (lower-cased, unique). */
export function extractMentionedEmails(body: string): string[] {
  const emails = new Set<string>();
  for (const match of body.matchAll(EMAIL_MENTION)) {
    const email = match[1]?.replace(/[.,;:!?]+$/, '').toLowerCase();
    if (email) emails.add(email);
  }
  return [...emails];
}
