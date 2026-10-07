import { ApiRequestError } from '@/lib/api-client';
import { InvalidFileError, UploadFailedError } from './upload';

export type AdminErrorKey =
  | 'fileType'
  | 'fileSize'
  | 'audioUnreadable'
  | 'storageDown'
  | 'uploadFailed'
  | 'notStored'
  | 'paymentsDown'
  | 'notFound'
  | 'conflict'
  | 'rejected'
  | 'tooMany'
  | 'generic';

/** An i18n key under `admin.errors`. The API's own message is shown separately for conflicts and rule violations. */
export function adminErrorKey(
  error: unknown,
  context: 'upload' | 'other' = 'other',
): AdminErrorKey {
  if (error instanceof InvalidFileError) return error.problem === 'type' ? 'fileType' : 'fileSize';
  if (error instanceof UploadFailedError) return 'uploadFailed';
  if (error instanceof Error && error.message.startsWith('Unreadable audio'))
    return 'audioUnreadable';
  if (!(error instanceof ApiRequestError)) return 'generic';
  switch (error.status) {
    case 503:
      return context === 'upload' ? 'storageDown' : 'paymentsDown';
    case 404:
      return 'notFound';
    case 409:
      return context === 'upload' ? 'notStored' : 'conflict';
    case 400:
    case 422:
      return 'rejected';
    case 429:
      return 'tooMany';
    default:
      return 'generic';
  }
}

/** The server's own explanation for a rule it enforces (for example "a track in a published program cannot be archived"). */
export const serverMessage = (error: unknown): string | null =>
  error instanceof ApiRequestError && [409, 422].includes(error.status)
    ? (error.body?.message ?? null)
    : null;
