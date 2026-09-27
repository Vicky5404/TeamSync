import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Error body returned for every non-2xx response. */
export class ApiErrorDto {
  @ApiProperty({ example: 'VALIDATION_ERROR', description: 'Stable, machine-readable error code' })
  code: string;

  @ApiProperty({ example: 'Some fields are invalid.' })
  message: string;

  @ApiPropertyOptional({
    description: 'Per-field messages (validation errors)',
    type: 'object',
    additionalProperties: { type: 'array', items: { type: 'string' } },
    example: { email: ['email must be an email'] },
  })
  fieldErrors?: Record<string, string[]>;

  @ApiPropertyOptional({ example: '0b8f7a0e-9a0c-4d8e-8d0f-2d3c9a1b5e11' })
  requestId?: string;
}
