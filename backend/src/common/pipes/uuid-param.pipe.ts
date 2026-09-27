import { ParseUUIDPipe } from '@nestjs/common';

import { Errors } from '../errors/api-exception.js';

/** Route-param UUID validation; malformed ids are reported as "not found", never as 500s. */
export const uuidParam = (resource: string) =>
  new ParseUUIDPipe({ exceptionFactory: () => Errors.notFound(resource) });
