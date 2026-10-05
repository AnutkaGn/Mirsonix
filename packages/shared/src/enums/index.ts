import { z } from 'zod';

/** Defines a Zod enum plus a matching runtime-const object and TS type, from one tuple. */
const defineEnum = <const T extends readonly [string, ...string[]]>(values: T) => ({
  values,
  schema: z.enum(values),
});

export const UserRole = defineEnum(['USER', 'ADMIN'] as const);
export type UserRole = z.infer<typeof UserRole.schema>;

export const AuthProvider = defineEnum(['GOOGLE'] as const);
export type AuthProvider = z.infer<typeof AuthProvider.schema>;

export const ContentStatus = defineEnum(['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const);
export type ContentStatus = z.infer<typeof ContentStatus.schema>;

export const WaveType = defineEnum(['SINE', 'BINAURAL', 'ISOCHRONIC', 'MONAURAL'] as const);
export type WaveType = z.infer<typeof WaveType.schema>;

export const BillingInterval = defineEnum(['MONTH', 'YEAR'] as const);
export type BillingInterval = z.infer<typeof BillingInterval.schema>;

export const MediaKind = defineEnum(['AUDIO', 'IMAGE'] as const);
export type MediaKind = z.infer<typeof MediaKind.schema>;

export const MediaStatus = defineEnum(['PENDING', 'READY', 'FAILED'] as const);
export type MediaStatus = z.infer<typeof MediaStatus.schema>;

/** Mirrors Stripe's subscription statuses. */
export const SubscriptionStatus = defineEnum([
  'INCOMPLETE',
  'INCOMPLETE_EXPIRED',
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'CANCELED',
  'UNPAID',
  'PAUSED',
] as const);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatus.schema>;

export const AccessGrantSource = defineEnum(['ADMIN', 'PROMO'] as const);
export type AccessGrantSource = z.infer<typeof AccessGrantSource.schema>;

export const AccessSource = defineEnum(['TRACK_SUBSCRIPTION', 'PROGRAM_SUBSCRIPTION', 'GRANT'] as const);
export type AccessSource = z.infer<typeof AccessSource.schema>;

export const WuXingElement = defineEnum(['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'] as const);
export type WuXingElement = z.infer<typeof WuXingElement.schema>;

export const Polarity = defineEnum(['YIN', 'YANG'] as const);
export type Polarity = z.infer<typeof Polarity.schema>;

export const InvoiceStatus = defineEnum(['DRAFT', 'OPEN', 'PAID', 'UNCOLLECTIBLE', 'VOID'] as const);
export type InvoiceStatus = z.infer<typeof InvoiceStatus.schema>;

export const StripeEventStatus = defineEnum(['RECEIVED', 'PROCESSED', 'FAILED'] as const);
export type StripeEventStatus = z.infer<typeof StripeEventStatus.schema>;
