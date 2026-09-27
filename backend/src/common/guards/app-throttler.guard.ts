import { type ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate limiting keyed by user for authenticated requests (the JWT guard runs
 * first) and by client IP otherwise. WebSocket traffic has its own limiter.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override shouldSkip(context: ExecutionContext): Promise<boolean> {
    return Promise.resolve(context.getType() !== 'http');
  }

  protected override getTracker(request: Record<string, unknown>): Promise<string> {
    const user = request.user as { id?: string } | undefined;
    if (user?.id) return Promise.resolve(`user:${user.id}`);
    return Promise.resolve(`ip:${typeof request.ip === 'string' ? request.ip : 'unknown'}`);
  }
}
