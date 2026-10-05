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
