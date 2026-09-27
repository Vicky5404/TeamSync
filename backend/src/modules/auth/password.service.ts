import { Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';

/** OWASP-recommended Argon2id parameters (19 MiB memory, 2 iterations, 1 lane). */
const HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);
  private dummyHash: Promise<string> | undefined;

  hash(password: string): Promise<string> {
    return argon2.hash(password, HASH_OPTIONS);
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch (error) {
      this.logger.warn(
        `Password verification failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /** True when the stored hash uses outdated parameters and should be upgraded on login. */
  needsRehash(hash: string): boolean {
    try {
      return argon2.needsRehash(hash, HASH_OPTIONS);
    } catch {
      return false;
    }
  }

  /**
   * Burn the same CPU time as a real verification when the account doesn't
   * exist, so response timing doesn't reveal which emails are registered.
   */
  async verifyDummy(password: string): Promise<void> {
    this.dummyHash ??= this.hash('flowsync-timing-equalizer');
    await this.verify(await this.dummyHash, password);
  }
}
