import type { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

/** True when BullMQ will not retry this job again. */
export function isFinalAttempt(job: Job): boolean {
  return job.attemptsMade >= (job.opts.attempts ?? 1);
}

/**
 * Structured failure log. Retries are warnings; the last failed attempt is an
 * error (the job then stays in the failed set for inspection). Job payloads are
 * not logged — they may contain email addresses.
 */
export function logJobFailure(logger: Logger, job: Job | undefined, error: Error): void {
  if (!job) {
    logger.error({ err: error }, 'Job failed');
    return;
  }
  const context = {
    err: error,
    queue: job.queueName,
    job: job.name,
    jobId: job.id,
    attempt: job.attemptsMade,
    maxAttempts: job.opts.attempts ?? 1,
  };
  if (isFinalAttempt(job)) logger.error(context, 'Job failed permanently');
  else logger.warn(context, 'Job failed; will retry with backoff');
}

export function logJobCompleted(
  logger: Logger,
  job: Job,
  durationMs: number,
  result?: object,
): void {
  logger.log(
    { queue: job.queueName, job: job.name, jobId: job.id, durationMs, ...result },
    'Job completed',
  );
}
