# Mirsonix

Audio therapy and sound healing platform (frequency therapy plus Traditional Chinese Medicine: meridians, elements, back recovery). Users subscribe to individual tracks or programs, never to the whole platform.

@AGENTS.md

Engineering rules are in `.claude/rules/`: architecture, clean code, patterns, performance, security, database, TypeScript style, frontend, testing, execution limits. Read them before writing code.

## Stack

Turborepo + pnpm monorepo. `apps/api` NestJS 11 (Controller → Service → Repository, Zod validation via `nestjs-zod`), `apps/web` React 19 + Vite + Tailwind v4 + shadcn/Radix + TanStack Query + Zustand, `packages/shared` Zod schemas, types, enums, constants (built with tsup, consumed by both apps), PostgreSQL + TypeORM, AWS S3 pre-signed URLs, Stripe subscriptions (test mode).

## Product rules

- Access to a track = active subscription to the track, or to a program that contains it, or a manual grant. One `AccessService` answers this. Nothing else decides access.
- PAST_DUE blocks access immediately. Canceling keeps access until the paid period ends.
- One currency (USD). Money is stored in minor units.
- Audio is private. The backend issues a short-lived pre-signed S3 URL only after the access check. Covers are public.
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
- API tests need Postgres up: they recreate a `mirsonix_test` database and run the real migrations. They run serially (`--no-file-parallelism`).
- In API e2e tests `vi.resetModules()` makes a fresh module graph, so import DI tokens inside the helper callback (see `test/helpers/test-app.ts`).
- `NODE_ENV=test` disables rate limiting. Never put `NODE_ENV` in `.env`: the web app reads the same file, and Vite would then compile the production bundle in development mode. The API defaults to `development`; set it in the deploy environment.
- Local secrets live in `.env` (gitignored, never print it). `.env.example` is the template.
