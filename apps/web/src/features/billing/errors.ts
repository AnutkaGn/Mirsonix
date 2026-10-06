import { ApiRequestError } from '@/lib/api-client';

/** An i18n key under `billing.errors` for what went wrong, in words the listener can act on. */
export function billingErrorKey(error: unknown): 'alreadySubscribed' | 'unavailable' | 'paymentsDown' | 'tooMany' | 'noBillingAccount' | 'generic' {
  if (!(error instanceof ApiRequestError)) return 'generic';
  switch (error.status) {
    case 409:
      return 'alreadySubscribed';
    case 404:
    case 422:
      return 'unavailable';
    case 503:
      return 'paymentsDown';
    case 429:
      return 'tooMany';
    default:
      return 'generic';
  }
}
