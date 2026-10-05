# Architecture

Dependencies point inward. HTTP and TypeORM stay at the edges.

API module (`apps/api/src/modules/<feature>/`):

- `*.controller.ts` — HTTP only
- `*.service.ts` — use case
- `*.repository.ts` — persistence
- `*.port.ts` — abstract class for an external system (`GoogleOAuthPort`)
- `entities/` — TypeORM entities
- `*.module.ts` — wires the feature and exports the service, not the repository

Patterns:

- **Port and adapter** when a use case calls an external system. The service depends on the port; the concrete class is the Nest provider.
- **Repository** for every aggregate. Services do not inject `Repository<Entity>`.
- **Module boundary**: other features import the module and call the exported service.

Web: pages in `pages/`, layouts in `layouts/`, server access in `lib/`. UI does not import API entities.

Shared contracts live in `packages/shared`. Do not copy them into `apps/`.

```typescript
// ❌ BAD
constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

// ✅ GOOD
constructor(private readonly repository: UsersRepository) {}
```
