# TypeScript style

Strict mode is on. Match the surrounding code before introducing a new style.

- No `any`. Use `unknown` and narrow it, or a Zod schema.
- No non-null assertion (`!`) unless the invariant is guaranteed and a short comment says why.
- `import type` for type-only imports. The API is the exception: Nest DI needs runtime imports (lint is relaxed there on purpose).
- Named exports. Default export only where a tool requires it (config files).
- Files are `kebab-case` with a role suffix: `users.service.ts`, `auth-identity.entity.ts`. Classes are `PascalCase`, functions and variables `camelCase`, constants `SCREAMING_SNAKE_CASE`, booleans read as questions: `isActive`, `hasAccess`.
- A function does one thing. Use early returns instead of nesting. Extract when it needs a comment to explain a block.
- No magic numbers or strings. Put shared values in `@mirsonix/shared` constants, local ones in a named `const`.
- Promises are awaited. A deliberately un-awaited promise is written `void somePromise()`.
- Errors: throw a specific exception (`UnauthorizedException`, a domain error) with a useful message. No empty `catch`. Do not catch just to rethrow.
- Prefer immutable data, `readonly` fields, and `const`. Do not mutate arguments.
- A type derived from a Zod schema (`z.infer`) is the contract. Do not write a parallel interface by hand.
- Comments explain why, not what. Remove commented-out code and stray `console.log`.
- Formatting is Prettier's job: run `pnpm format` for files you touched. Lint must be clean, with no new warnings.
