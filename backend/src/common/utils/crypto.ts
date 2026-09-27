import { createHash, randomBytes } from 'node:crypto';

/** Cryptographically random, URL-safe token (default 256 bits). */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/**
 * One-way hash for high-entropy secrets (refresh/verification/reset tokens).
 * A fast hash is appropriate here because the inputs are random 256-bit values,
 * not user-chosen passwords.
 */
export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
