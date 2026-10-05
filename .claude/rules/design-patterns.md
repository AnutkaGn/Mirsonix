# Design patterns

Use a pattern when it removes a real problem in this code. Do not add one for its own sake. A second use justifies an abstraction; a first use does not.

## Use these here

| Pattern | Where | Example |
|---|---|---|
| **Repository** | every aggregate | `UsersRepository` wraps TypeORM; services never touch `Repository<T>` |
| **Port and adapter** | every external system | `GoogleOAuthPort` → `GoogleOAuthService`; add `StoragePort` (S3) and `PaymentsPort` (Stripe) the same way |
| **Facade** | one entry point over several subsystems | `AccessService.canAccessTrack()` hides subscription, program, and grant lookups |
| **Strategy** | interchangeable rules selected by a value | one class per Stripe event type behind a handler map instead of a growing `switch` |
| **State machine** | status with legal transitions | subscription status changes go through one function that rejects illegal moves |
| **Factory** | building a valid object in one place | test fixtures; token and session builders |
| **Unit of work** | several writes that succeed together | `manager.transaction(...)` for account plus identity |
| **Decorator / Guard** | cross-cutting concerns | `@Public()`, `@Roles()`, throttling, never copy-pasted checks |
| **Observer** | side effects that must not couple to the main flow | emit a domain event for audit log or stats, do not call them inline |
| **Dependency injection** | always | depend on a class or abstract class, never `new` a collaborator |
| **Compound component** | React player and lists | `<Player.Root>`, `<Player.Controls>`, `<Player.Queue>` share state through context |
| **Custom hook** | reusable stateful logic in React | `useAudioPlayer`, `useLibrary` |

## Rules

- Prefer composition over inheritance. Inheritance only for a framework contract or an abstract port.
- Program to an interface: the caller knows the port, not the vendor SDK.
- Replace a `switch` over a type with a lookup map or polymorphism once it has a third case.
- Keep one source of truth. Business rules live in one function, and everything else calls it.
- Pure functions for logic, thin classes for wiring.

```typescript
// ❌ BAD — service knows Stripe's SDK
constructor(private readonly stripe: Stripe) {}

// ✅ GOOD — service knows a port, Stripe is an adapter
constructor(private readonly payments: PaymentsPort) {}
```

```typescript
// ❌ BAD — grows with every event
switch (event.type) { case 'invoice.paid': /* ... */ break; /* ... */ }

// ✅ GOOD — one handler per event
const handler = this.handlers.get(event.type);
if (handler) await handler.handle(event);
```
