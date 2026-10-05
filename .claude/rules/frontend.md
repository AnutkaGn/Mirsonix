---
paths:
  - "apps/web/**"
---

# Frontend

## State

- **Server state** (anything fetched) is TanStack Query. Never copy it into Zustand.
- **Client state** (player, queue, auth session, UI) is Zustand. Subscribe with selectors.
- Query keys come from one factory per feature (`libraryKeys.list(filters)`), not inline arrays.
- Components do not call `fetch`. They use a feature hook that wraps `apiRequest`.

## Structure

```
features/<feature>/   api.ts · hooks.ts · components · *.spec.ts(x)
pages/                route components, thin: compose features
layouts/              shells (PublicLayout, AdminLayout)
components/ui/        shadcn primitives, no business logic
lib/                  api client, env, utils
stores/               Zustand stores
```

- Separate UI from state. A component renders props and calls actions. Logic lives in hooks and stores so it can be tested without rendering.
- The audio player and lists are **compound components** that share context (`Player.Root`, `Player.Controls`, `Player.Progress`, `Player.Queue`). The store owns playback, and the components never create their own `Audio`.

## Quality

- Every query has loading, error, and empty states.
- Forms validate with the shared Zod schema and show field errors next to the field.
- No hard-coded user-facing strings. Add a key to `i18n/locales/en/common.json` and use `t()`.
- Style with Tailwind and the design tokens in `index.css`. No raw hex colors. Merge classes with `cn()`.
- Accessible by default: Radix primitives for dialogs, menus, and sliders. Every control has a label, keyboard works, and focus is visible.
- Route-level components are lazy-loaded, the admin area especially.
- The API enforces access. `RequireAuth` and role checks in the UI are convenience only.
- Test hooks, stores, and the API client with Vitest. Test components through user behavior (Testing Library), not implementation details.
