import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { PinoLogger } from 'nestjs-pino';
import type { Observable } from 'rxjs';

/**
 * Adds the authenticated user and the resolved organization to every log line
 * written while handling the request (guards have run by now). The request's
 * completion log gets the same fields from the logger's `customProps`.
 */
@Injectable()
export class LogContextInterceptor implements NestInterceptor {
  constructor(private readonly logger: PinoLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() === 'http') {
      const request = context.switchToHttp().getRequest<Request>();
      const fields = {
        ...(request.user ? { userId: request.user.id } : {}),
        ...(request.access ? { organizationId: request.access.organizationId } : {}),
      };
      if (Object.keys(fields).length > 0) {
        try {
          this.logger.assign(fields);
        } catch {
          // Outside a request logging context (e.g. excluded routes): nothing to enrich.
        }
      }
    }
    return next.handle();
  }
}
