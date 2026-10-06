/** Only USD at the moment; kept as a constant so a second currency is a localised change. */
export const CURRENCY = 'usd' as const;

export const DEFAULT_LOCALE = 'en' as const;
export const SUPPORTED_LOCALES = [DEFAULT_LOCALE] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** Subscriptions with these statuses grant access. PAST_DUE blocks immediately by product decision. */
export const ACCESS_GRANTING_STATUSES = ['ACTIVE', 'TRIALING'] as const;

/** A listen is counted after >= 30 s or >= 50% of the track, once per playback session. */
export const LISTEN_MIN_SECONDS = 30;
export const LISTEN_MIN_RATIO = 0.5;

export const PAGINATION = { defaultLimit: 20, maxLimit: 100 } as const;

export const UPLOAD_LIMITS = {
  audio: {
    maxBytes: 200 * 1024 * 1024,
    mimeTypes: ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/wav', 'audio/x-wav'],
  },
  image: {
    maxBytes: 10 * 1024 * 1024,
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
} as const;

/** httpOnly cookie carrying the opaque refresh token; scoped to /auth so it is not sent to other endpoints. */
export const REFRESH_COOKIE_NAME = 'mx_rt';
export const REFRESH_COOKIE_PATH = '/auth';

/** One bucket holds everything; the key prefix decides visibility. `audio/` is never public. */
export const STORAGE_PREFIX = { audio: 'audio', cover: 'covers' } as const;

/** How long a presigned upload form stays valid. */
export const UPLOAD_URL_TTL_SECONDS = 15 * 60;
/** Lifetime of a signed cover URL when covers are not served from a public base URL. */
export const COVER_URL_TTL_SECONDS = 60 * 60;

/** Stripe refuses charges under $0.50, and a price above $10,000 a period is almost certainly a typo. */
export const MIN_PRICE_MINOR = 50;
export const MAX_PRICE_MINOR = 1_000_000;

/**
 * An ACTIVE subscription whose paid period ended longer ago than this is no longer trusted. Renewals arrive as
 * webhooks within minutes, so a longer gap means webhooks are being missed and access must not run on forever.
 */
export const ACCESS_PERIOD_GRACE_SECONDS = 6 * 60 * 60;

/** Where Stripe sends the browser back to, relative to the web origin. */
export const CHECKOUT_RETURN_PATHS = {
  success: '/library?checkout=success',
  cancel: '/?checkout=cancelled',
  portal: '/library',
} as const;
