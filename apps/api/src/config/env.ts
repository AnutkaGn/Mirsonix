import { z } from 'zod';

const optionalString = z.string().optional().transform((v) => (v ? v : undefined));

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.url(),
  DATABASE_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
  /** A just-rotated refresh token reused within this window is rejected without revoking the family (parallel tabs). */
  REFRESH_REUSE_GRACE_SECONDS: z.coerce.number().int().min(0).default(10),
  BCRYPT_COST: z.coerce.number().int().min(4).max(15).default(12),

  // Third-party credentials are optional until the step that needs them (auth, media, billing).
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  GOOGLE_CALLBACK_URL: optionalString,

  AWS_REGION: z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: optionalString,
  AWS_SECRET_ACCESS_KEY: optionalString,
  S3_BUCKET_PRIVATE_AUDIO: optionalString,
  S3_BUCKET_PUBLIC_MEDIA: optionalString,
  S3_PUBLIC_BASE_URL: optionalString,
  S3_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(600),

  STRIPE_SECRET_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
}).superRefine((env, ctx) => {
  // .env.example ships a placeholder; a deployed API signing tokens with it would be forgeable.
  if (env.NODE_ENV === 'production' && /^change-me/i.test(env.JWT_ACCESS_SECRET)) {
    ctx.addIssue({ code: 'custom', path: ['JWT_ACCESS_SECRET'], message: 'must not be the example placeholder in production' });
  }
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
