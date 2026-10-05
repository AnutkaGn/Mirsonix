# Security

This product sells gated audio and handles payments and accounts. Treat these as defaults, not extras.

## Input and access

- Validate all external input at the edge with a shared Zod schema. Trust types only inside that boundary.
- Authorize on the server, in the service. The UI hiding a button is not access control.
- Check access to the specific resource, not just that the user is logged in. A track URL is only issued after `AccessService` allows that user and that track.
- Never accept a user id, role, or price from the client. Take them from the verified token or the database.
- Queries are parameterized or use the query builder. Never concatenate input into SQL.
- Admin actions write an audit log row.

## Secrets and data

- Secrets come from env, validated in `config/env.ts`. Never hard-code, never commit, never put in a Vite `VITE_*` variable. Do not read, print, or log `.env` values.
- Never log passwords, tokens, cookies, full card data, or webhook payloads with personal data.
- Passwords are bcrypt-hashed. Refresh tokens and reset tokens are stored hashed. Compare secrets in constant time.
- Return the same error for "unknown user" and "wrong password". Do not reveal whether an account exists where you can avoid it.
- Entity columns holding secrets are `select: false`.

## Web and transport

- The refresh token lives only in an `httpOnly`, `SameSite=Lax` cookie, `Secure` in production. The access token lives in memory and is never written to `localStorage`.
- CORS allows the exact web origin, never `*` with credentials.
- Rate-limit every credential endpoint and every endpoint that sends email or SMS.
- No `dangerouslySetInnerHTML` with user content. Never build URLs or HTML from unescaped input.
- Redirect targets are fixed or allow-listed, never taken from a query string.

## Billing and storage

- Stripe webhooks verify the signature on the raw body and are idempotent. The Stripe event id is the key.
- Stripe is the source of truth for subscription state. Never grant access from a client-side redirect.
- Pre-signed URLs are short-lived (`S3_SIGNED_URL_TTL_SECONDS`), scoped to one object, and issued per request, never stored.
- Buckets are private. Only cover images are public.
- Validate uploads: MIME type and size from `UPLOAD_LIMITS`, checked on the server again at confirm.

## Dependencies

- Do not add a package for something the repo or the platform already provides. Prefer maintained packages with a clear purpose. State why a new dependency is needed.
