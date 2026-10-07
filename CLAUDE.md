# Mirsonix

Audio therapy and sound healing platform (frequency therapy plus Traditional Chinese Medicine: meridians, elements, back recovery). Users subscribe to individual tracks or programs, never to the whole platform.

@AGENTS.md

Engineering rules are in `.claude/rules/`: architecture, clean code, patterns, performance, security, database, TypeScript style, frontend, testing, execution limits. Read them before writing code.

## Stack

Turborepo + pnpm monorepo. `apps/api` NestJS 11 (Controller → Service → Repository, Zod validation via `nestjs-zod`), `apps/web` React 19 + Vite + Tailwind v4 + shadcn/Radix + TanStack Query + Zustand, `packages/shared` Zod schemas, types, enums, constants (built with tsup, consumed by both apps), PostgreSQL + TypeORM, AWS S3 pre-signed URLs, Stripe subscriptions (test mode).

## Web architecture (`apps/web/src`)

- Server data is TanStack Query (one key factory per feature in `features/<x>/api.ts`); client state is Zustand. Pages in `pages/` are thin and lazy-loaded; `features/` own the logic.
- Catalog filters and the page number live in the **URL** (`features/catalog/filters.ts` parses and drops invalid values), so views are shareable and the back button works.
- The player (`features/player`): `player.store.ts` holds what the listener *asked for* (`wantsPlay`, queue, loop, sleep timer, speed) and `loadId` (bump it to make the engine reload a track); `progress.store.ts` holds the playhead separately so only the progress bar re-renders 4×/s; `PlayerEngine.tsx` is the only `<audio>` element and the only place that turns intent into sound. `parts.tsx` are the compound components (`import * as Player from './parts'`), composed by `MiniPlayer` and `FullPlayer`. `SessionReporter` sends listen heartbeats (best effort, never interrupts playback).
- Stream links are short-lived: the engine asks for a fresh one after a long pause or an audio error, without starting a new listening session. A purchase is remembered in `sessionStorage` across the trip to Stripe so the library can recognise it when the webhook lands.
- Logging out clears the player queue and the query cache.
- Admin (`/admin`, role ADMIN, lazy-loaded, own `AdminLayout`): `features/admin` holds the logic. Pure, tested helpers: `forms.ts` (form values ⇄ shared Zod input, field errors `required`/`invalid`), `money.ts` (dollars ⇄ minor units), `upload.ts` (file check, presigned POST via XHR for progress, browser-measured audio duration, 2-step ticket → confirm), `program-order.ts`, `list-params.ts` (admin list filters live in the URL). The program builder edits the ordered list locally and saves it once (`PUT /admin/programs/:id/tracks`); a new track can be created inside it. Server rule violations (409/422) show the API's own message. Every admin mutation invalidates the admin and public catalog caches.
- Statistics (`modules/stats`, `GET /admin/stats/{summary,revenue,top}?days=`): read-only SQL aggregates. The window is `days` UTC calendar days ending today. Revenue = paid invoices minus refunds; "active" uses the same validity rule as access; a "sale" is a subscription past checkout (not INCOMPLETE); a listen is a `counted_as_listen` session (program listens need `program_id` on the session).

## Product rules

- Access to a track = active subscription to the track, or to a program that contains it, or a manual grant. One `AccessService` (`modules/access`) answers this. Nothing else decides access. Archived content stays playable for people who subscribed.
- PAST_DUE blocks access immediately. Canceling keeps access until the paid period ends. An ACTIVE subscription whose period ended over 6 hours ago is distrusted (missed webhooks).
- Stripe is the source of truth. Webhooks (`POST /billing/webhook`: verified signature, idempotent by event id, upserts) update `subscriptions`/`invoices`; opening checkout grants nothing. The price and the target always come from our own tables, never from the client or from webhook metadata. Setup: `docs/billing.md`. Stripe keys are filled in last; until then billing answers 503 and tests use a fake `PaymentsPort`.
- A published item may have no price (it just cannot be bought). Prices are set by admins in cents; a change creates a new Stripe price and archives the old.
- One currency (USD). Money is stored in minor units.
- One S3 bucket (`S3_BUCKET`). Audio under `audio/` is private: the backend issues a short-lived pre-signed URL only after the access check. Covers under `covers/` may be public (`S3_PUBLIC_BASE_URL`), otherwise they are signed. Setup: `docs/storage.md`. AWS keys are filled in last; until then upload endpoints answer 503 and tests use a fake storage.
- Content lifecycle: DRAFT → PUBLISHED ⇄ ARCHIVED, never back to DRAFT. Publishing a track needs a cover; a program needs a poster and only published tracks. A track in a published program cannot be archived.
- Roles: `USER`, `ADMIN`. Only English for now, but all UI strings go through i18n.

## Commands

```bash
pnpm db:up               # Postgres in Docker (OrbStack must be running)
pnpm db:migrate          # build + run migrations
pnpm db:seed             # elements, meridians, issues, admin (from .env)
pnpm dev                 # api :4000 + web :5173
pnpm turbo run build lint typecheck test
pnpm --filter @mirsonix/api db:migration:generate src/database/migrations/<Name>
```

## Gotchas

- Postgres is on host port **5433** (the machine has another Postgres on 5432). Another app uses port 3000, so the API is on **4000**.
- TypeScript is pinned to 6.0.x (typescript-eslint does not support 7). NestJS is pinned to 11 (`nestjs-zod` does not support 12).
- The TypeORM CLI and seeds run from compiled `dist/`, so `db:*` scripts build first. Entities state column types explicitly.
- The sandbox only allows writes in the project and temp dirs, so SWC (used by API tests) intermittently cannot write its cache lock under `~/Library/Caches`. Run the API tests with the sandbox disabled, or allow `~/Library/Caches/swc-native-501` in the sandbox settings.
- API tests need Postgres up: they recreate a `mirsonix_test` database and run the real migrations. They run serially (`--no-file-parallelism`).
- In API e2e tests `vi.resetModules()` makes a fresh module graph, so import DI tokens inside the helper callback (see `test/helpers/test-app.ts`).
- `NODE_ENV=test` disables rate limiting. Never put `NODE_ENV` in `.env`: the web app reads the same file, and Vite would then compile the production bundle in development mode. The API defaults to `development`; set it in the deploy environment.
- Web tests share `src/test/setup.ts` (jest-dom matchers and stubs for browser APIs Radix needs). jsdom has no audio, so `PlayerEngine.spec.tsx` stubs `play`/`pause`/`load` and fires media events by hand; open Radix menus in tests with the keyboard (`Enter` on the trigger). A test probe must not be an `<output>`: it has the `status` role.
- Local secrets live in `.env` (gitignored, never print it). `.env.example` is the template.
