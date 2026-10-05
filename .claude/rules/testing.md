# Tests ship with the change

Every behavior change includes tests in the same edit. Do not leave them for a follow-up.

- API unit tests: `apps/api/src/**/*.spec.ts`, next to the file under test
- API e2e: `apps/api/test/**/*.e2e-spec.ts` (real Nest app, real Postgres test database)
- Web: `apps/web/src/**/*.spec.ts` or `*.spec.tsx` (Vitest + Testing Library)

## What to cover

The main logic gets tests. Aim for at least 80% line and branch coverage on code you add or change in services, guards, repositories with queries, shared Zod schemas, stores, hooks, and the API client. Do not chase coverage on modules, DTO declarations, entities, and wiring.

For each unit of logic cover the success path, every boundary (empty, max, off-by-one), and each failure branch.

Money, access, and auth are critical paths. They get a test for every branch, including the denial: expired, canceled, past due, wrong role, someone else's resource.

## How

- Unit tests mock repositories and ports. They do not call the network or a real database.
- E2E tests drive HTTP against the real database and verify behavior end to end. Use them for constraints, guards, and flows.
- Test behavior, not implementation. Assert outputs and effects, not which private method ran.
- A test must fail if the logic is removed. Check this when the change is small: break the code, see it fail.
- One reason to fail per test. Name it by behavior: `rejects a replayed refresh token`.
- Build fixtures with small factory helpers. Do not copy-paste setup.
- No sleeps and no real time. Inject the clock or use fake timers.
- Do not skip or delete a failing test to get green. Fix the code or the test.

```typescript
// ❌ BAD — new branch, no spec
async exchangeCode(code: string) { /* ... */ }

// ✅ GOOD — google-oauth.service.spec.ts
it('rejects a token response without an id_token', async () => {
  await expect(service.exchangeCode('code')).rejects.toBeInstanceOf(UnauthorizedException);
});
```

## Before you finish

Run the package test command and fix failures. For a feature, check coverage of the files you touched:

`pnpm --filter @mirsonix/api test:coverage` or `pnpm --filter @mirsonix/web test:coverage`
