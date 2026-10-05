# Performance

Write the efficient version the first time. Measure before adding anything clever.

## Database

- No query inside a loop. Load related rows with one join, one `In([...])`, or one aggregate.
- Select only the columns you need on list endpoints. Do not hydrate whole entity graphs.
- Every list endpoint paginates, with a hard maximum from `PAGINATION` in `@mirsonix/shared`.
- Every column in a hot `WHERE`, `JOIN`, or `ORDER BY` has an index. Add it in the entity, and use a partial index when a filter is constant (`WHERE is_active`).
- Use `EXISTS` for yes or no questions such as access checks. Do not count or load rows.
- Aggregate in SQL (`SUM`, `COUNT ... GROUP BY`), not in JavaScript.
- Keep transactions short. Do no network call inside one.
- For a new hot query, run `EXPLAIN` once and confirm it uses the index.

```typescript
// ❌ BAD — N+1
for (const t of tracks) t.programs = await this.programs.findByTrack(t.id);

// ✅ GOOD — one query
const links = await this.programTracks.findByTrackIds(tracks.map((t) => t.id));
```

## API

- Never block the event loop: async bcrypt, no sync fs, no large JSON work in a request.
- Audio never flows through the API. The API issues a short-lived pre-signed S3 URL and the client streams from S3 with Range requests.
- Cache only data that is read often, changes rarely, and has a clear invalidation point. Say where it is invalidated.
- Do independent awaits together with `Promise.all`.

## Web

- Server data lives in TanStack Query with a stable query key. Set `staleTime` deliberately and use `select` to derive a slice.
- Zustand: subscribe with a selector (`useStore((s) => s.x)`), never the whole store, so unrelated updates do not re-render.
- No derived state in `useEffect`. Compute it during render.
- Do not add `memo`, `useMemo`, or `useCallback` without a measured reason.
- Code-split routes with `React.lazy`, and especially the admin area. Keep the initial bundle small.
- Lists with many rows use pagination or virtualization.
- The audio player must not re-render the tree on every `timeupdate`. Keep progress in a store slice that only the progress bar reads.
