import type { AccessInfo } from '@mirsonix/shared';

export interface AccessDescription {
  /** An i18n key under `library.access`. */
  key: 'renews' | 'ends' | 'active' | 'granted' | 'grantedUntil';
  /** ISO date to show next to it, when there is one. */
  date: string | null;
}

/** How to tell a listener where their access stands, in the way that matters: does it carry on, or stop, and when. */
export function describeAccess(access: AccessInfo): AccessDescription {
  if (access.source === 'GRANT') return { key: access.validUntil ? 'grantedUntil' : 'granted', date: access.validUntil };
  if (access.cancelAtPeriodEnd) return { key: 'ends', date: access.validUntil };
  return access.validUntil ? { key: 'renews', date: access.validUntil } : { key: 'active', date: null };
}
