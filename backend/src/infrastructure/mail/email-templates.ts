import type { EmailTemplate } from '../queue/queue.constants.js';

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function layout(
  heading: string,
  paragraphs: string[],
  action?: { label: string; url: string },
): string {
  const body = paragraphs
    .map((paragraph) => `<p style="margin:0 0 16px">${escapeHtml(paragraph)}</p>`)
    .join('');
  const button = action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(action.url)}" style="background:#4f46e5;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600">${escapeHtml(action.label)}</a></p>
       <p style="margin:0;color:#6b7280;font-size:12px">If the button doesn't work, paste this link into your browser:<br>${escapeHtml(action.url)}</p>`
    : '';
  return `<!doctype html><html><body style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#111827;background:#f9fafb;padding:24px">
<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:32px">
<h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(heading)}</h1>${body}${button}
<p style="margin:32px 0 0;color:#9ca3af;font-size:12px">FlowSync</p></div></body></html>`;
}

function text(paragraphs: string[], action?: { label: string; url: string }): string {
  return [...paragraphs, ...(action ? [`${action.label}: ${action.url}`] : [])].join('\n\n');
}

/** Render a transactional email. All interpolated values are HTML-escaped. */
export function renderEmail(email: EmailTemplate): RenderedEmail {
  switch (email.template) {
    case 'verify-email': {
      const paragraphs = [
        `Hi ${email.data.name},`,
        'Confirm your email address to finish setting up your FlowSync account. The link expires in 24 hours.',
      ];
      const action = { label: 'Verify email', url: email.data.link };
      return {
        subject: 'Verify your email address',
        text: text(paragraphs, action),
        html: layout('Verify your email', paragraphs, action),
      };
    }
    case 'reset-password': {
      const paragraphs = [
        `Hi ${email.data.name},`,
        'We received a request to reset your FlowSync password. The link expires in 1 hour. If you did not request this, you can ignore this email.',
      ];
      const action = { label: 'Reset password', url: email.data.link };
      return {
        subject: 'Reset your password',
        text: text(paragraphs, action),
        html: layout('Reset your password', paragraphs, action),
      };
    }
    case 'invitation': {
      const { organizationName, inviterName, role, message, link } = email.data;
      const paragraphs = [
        `${inviterName} invited you to join ${organizationName} on FlowSync as ${role.toLowerCase()}.`,
        ...(message ? [`“${message}”`] : []),
        'The invitation expires in 7 days.',
      ];
      const action = { label: 'Accept invitation', url: link };
      return {
        subject: `${inviterName} invited you to ${organizationName}`,
        text: text(paragraphs, action),
        html: layout(`Join ${organizationName}`, paragraphs, action),
      };
    }
    case 'notification': {
      const paragraphs = email.data.body ? [email.data.body] : [];
      const action = email.data.link
        ? { label: 'Open in FlowSync', url: email.data.link }
        : undefined;
      return {
        subject: email.data.title,
        text: text([email.data.title, ...paragraphs], action),
        html: layout(email.data.title, paragraphs, action),
      };
    }
  }
}
