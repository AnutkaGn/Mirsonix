---
paths:
  - "apps/api/src/database/**"
  - "apps/api/src/**/*.entity.ts"
  - "apps/api/src/**/*.repository.ts"
---

# Database

Postgres is the source of truth. The schema is changed only by migrations.

- `synchronize` stays `false`. Never edit the database by hand to change structure.
- Change an entity, then `pnpm db:migration:generate src/database/migrations/<Name>` and **read the generated SQL**. Re-run the generate command: it must report no changes.
- Never edit a migration that has been applied or committed. Add a new one. Every migration has a working `down`.
- Anything TypeORM cannot express (extensions, data backfills) goes in a hand-written migration with an earlier or later timestamp as needed.
- State column types explicitly (`type: 'varchar', length: 120`). Do not rely on reflected types.
- Express integrity in the database, not only in code: `@Check`, `@Unique`, partial `@Index`, foreign keys with an explicit `onDelete`.
- Money is an integer in minor units. Timestamps are `timestamptz`. Primary keys are `uuid`.
- One Postgres enum per table column (`track_status`, not a shared `content_status`). Build it from the shared enum tuple with `EnumColumn`.
- Soft-delete only where history matters (`users`). Financial rows are never hard-deleted: foreign keys to them are `RESTRICT`.
- A repository returns domain data. It does not leak query builders or `Repository<T>` to services.
- Seeds are idempotent: running them twice changes nothing.
- A new constraint or index gets a test in `apps/api/test/schema.e2e-spec.ts` that proves the database rejects the bad data.
- Do not drop, truncate, or delete real data in the dev database. The test database is recreated by the test helper.
