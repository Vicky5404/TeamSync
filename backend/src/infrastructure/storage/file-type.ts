/**
 * Content-based file type detection. The client-declared MIME type and file
 * extension are never trusted on their own: a file is accepted only if its
 * extension is on the allow-list AND its bytes match that type's signature.
 * Active content (HTML, SVG, scripts, executables) is intentionally excluded.
 */

export interface FileTypeInfo {
  mime: string;
  extension: string;
}

interface FileTypeRule {
  mime: string;
  extensions: readonly string[];
  /** Binary signature check; text types use UTF-8 validation instead. */
  matches?: (bytes: Buffer) => boolean;
  text?: boolean;
  image?: boolean;
}

const startsWith = (bytes: Buffer, signature: number[], offset = 0) =>
  bytes.length >= offset + signature.length &&
  signature.every((byte, index) => bytes[offset + index] === byte);

const ZIP = (bytes: Buffer) =>
  startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) || startsWith(bytes, [0x50, 0x4b, 0x05, 0x06]);
const OLE = (bytes: Buffer) => startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

const RULES: readonly FileTypeRule[] = [
  {
    mime: 'image/png',
    extensions: ['png'],
    image: true,
    matches: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  {
    mime: 'image/jpeg',
    extensions: ['jpg', 'jpeg'],
    image: true,
    matches: (b) => startsWith(b, [0xff, 0xd8, 0xff]),
  },
  {
    mime: 'image/gif',
    extensions: ['gif'],
    image: true,
    matches: (b) =>
      startsWith(b, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
      startsWith(b, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]),
  },
  {
    mime: 'image/webp',
    extensions: ['webp'],
    image: true,
    matches: (b) =>
      startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8),
  },
  {
    mime: 'application/pdf',
    extensions: ['pdf'],
    matches: (b) => startsWith(b, [0x25, 0x50, 0x44, 0x46, 0x2d]),
  },
  { mime: 'application/zip', extensions: ['zip'], matches: ZIP },
  {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extensions: ['docx'],
    matches: ZIP,
  },
  {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extensions: ['xlsx'],
    matches: ZIP,
  },
  {
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    extensions: ['pptx'],
    matches: ZIP,
  },
  { mime: 'application/msword', extensions: ['doc'], matches: OLE },
  { mime: 'application/vnd.ms-excel', extensions: ['xls'], matches: OLE },
  { mime: 'application/vnd.ms-powerpoint', extensions: ['ppt'], matches: OLE },
  { mime: 'text/plain', extensions: ['txt', 'log'], text: true },
  { mime: 'text/csv', extensions: ['csv'], text: true },
  { mime: 'text/markdown', extensions: ['md', 'markdown'], text: true },
  { mime: 'application/json', extensions: ['json'], text: true },
];

const utf8 = new TextDecoder('utf-8', { fatal: true });

/** Text files must decode as UTF-8 and contain no NUL bytes (binary masquerading as text). */
function looksLikeText(bytes: Buffer): boolean {
  // A multi-byte character may be cut at the sniffing boundary; drop a few trailing bytes.
  const sample = bytes.length > 8192 ? bytes.subarray(0, 8188) : bytes;
  if (sample.includes(0)) return false;
  try {
    utf8.decode(sample);
    return true;
  } catch {
    return false;
  }
}

export function fileExtension(fileName: string): string {
  const match = /\.([a-z0-9]{1,10})$/i.exec(fileName.trim());
  return match?.[1]?.toLowerCase() ?? '';
}

/** Bytes needed to identify any supported type. */
export const SNIFF_BYTES = 8192;

/** Allowed MIME types (for documentation and pre-upload validation). */
export const ALLOWED_ATTACHMENT_TYPES = RULES.map((rule) => rule.mime);
export const ALLOWED_IMAGE_TYPES = RULES.filter((rule) => rule.image).map((rule) => rule.mime);

/** Rule for a file name's extension, if the extension is allowed at all. */
export function ruleForFileName(fileName: string, options: { imagesOnly?: boolean } = {}) {
  const extension = fileExtension(fileName);
  const rule = RULES.find((candidate) => candidate.extensions.includes(extension));
  if (!rule || (options.imagesOnly && !rule.image)) return null;
  return { mime: rule.mime, extension };
}

/**
 * Verify that `bytes` (at least the first `SNIFF_BYTES`) really are the type the
 * file name claims. Returns the canonical type, or null if not acceptable.
 */
export function detectFileType(
  fileName: string,
  bytes: Buffer,
  options: { imagesOnly?: boolean } = {},
): FileTypeInfo | null {
  const extension = fileExtension(fileName);
  const rule = RULES.find((candidate) => candidate.extensions.includes(extension));
  if (!rule || (options.imagesOnly && !rule.image)) return null;
  const valid = rule.text ? looksLikeText(bytes) : (rule.matches?.(bytes) ?? false);
  return valid ? { mime: rule.mime, extension } : null;
}

/** Strip path components and control characters from a user-supplied file name. */
export function sanitizeFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (cleaned || 'file').slice(0, 255);
}
