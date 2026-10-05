import { z } from 'zod';
import { UserRole } from '../enums';

const utf8ByteLength = (value: string): number => {
  let bytes = 0;
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
};

/** bcrypt silently truncates input at 72 bytes, so longer passwords are rejected rather than half-ignored. */
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .refine((v) => utf8ByteLength(v) <= 72, 'Password is too long');

/** Normalise first, then validate: an address pasted with a stray space or capitals must still be accepted. */
const email = z.string().trim().toLowerCase().pipe(z.email().max(254));

export const registerSchema = z.object({
  email,
  password,
  displayName: z.string().trim().min(1).max(120).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email,
  // Not password-policy validated: a login attempt just has to be a non-empty string.
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const authUserSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  role: UserRole.schema,
  displayName: z.string().nullable(),
  locale: z.string(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const authSessionSchema = z.object({
  accessToken: z.string(),
  /** Seconds until the access token expires. */
  expiresIn: z.number().int().positive(),
  user: authUserSchema,
});
export type AuthSession = z.infer<typeof authSessionSchema>;
