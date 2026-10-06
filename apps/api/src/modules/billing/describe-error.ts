import { ZodError } from 'zod';

/** One line saying what went wrong with a webhook, short enough to read in a log and to store with the event. */
export function describeError(error: unknown): string {
  if (error instanceof ZodError) {
    const fields = [...new Set(error.issues.map((issue) => issue.path.join('.') || '(root)'))];
    return `Payload did not match the expected shape; check: ${fields.join(', ')}`;
  }
  return error instanceof Error ? error.message : String(error);
}
