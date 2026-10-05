# Clean code

- One reason to change per file. A controller maps HTTP, a service runs the use case, a repository talks to TypeORM.
- Names say what the thing does: `findByEmail`, not `getData`.
- No `any`. No empty `catch`. Throw a Nest HTTP exception or a domain error and keep the cause.
- Keep functions short. Extract a block when it needs a comment to explain it.
- Comment only a non-obvious constraint. Do not restate the code.
- Validate input at the edge with Zod (`nestjs-zod` on the API). Trust the types inside that boundary.
- Match the existing style. Do not add a library for something the repo already does.

```typescript
// ❌ BAD
catch (e) {}

// ✅ GOOD
if (!tokens.id_token) throw new UnauthorizedException('Google did not return an identity token');
```
