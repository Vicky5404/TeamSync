import { env } from '@/lib/env';
import { formatFileSize } from '@/utils/format';

/**
 * Attachment extensions the API accepts (mirrors `backend/src/infrastructure/storage/file-type.ts`).
 * The API additionally verifies file contents, so this is only for instant feedback.
 */
export const ATTACHMENT_EXTENSIONS = [
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'pdf',
  'zip',
  'docx',
  'xlsx',
  'pptx',
  'doc',
  'xls',
  'ppt',
  'txt',
  'log',
  'csv',
  'md',
  'markdown',
  'json',
] as const;

/** Value for `<input type="file" accept>`. */
export const ATTACHMENT_ACCEPT = ATTACHMENT_EXTENSIONS.map((extension) => `.${extension}`).join(
  ',',
);

function extensionOf(fileName: string): string {
  return /\.([a-z0-9]{1,10})$/i.exec(fileName.trim())?.[1]?.toLowerCase() ?? '';
}

/** Returns a user-facing reason when a file can't be attached, or null if it looks fine. */
export function validateAttachment(file: File): string | null {
  if (file.size === 0) return 'This file is empty.';
  if (file.size > env.uploadMaxFileSizeBytes) {
    return `Too large (${formatFileSize(file.size)}). Files can be up to ${formatFileSize(env.uploadMaxFileSizeBytes)}.`;
  }
  if (!(ATTACHMENT_EXTENSIONS as readonly string[]).includes(extensionOf(file.name))) {
    return 'Unsupported file type. Allowed: images, PDF, Office documents, ZIP and text files.';
  }
  return null;
}
