# Execute, don't delegate

Work autonomously on code. Run every command you can run yourself and do not ask for permission to write code, install a dependency, run a test, migrate the dev database, or start a dev server to verify a change.

- Tests: `pnpm --filter @mirsonix/api test` or `pnpm --filter @mirsonix/web test`
- Types: `pnpm typecheck`
- Lint: `pnpm lint`
- Full suite, when a change crosses packages: `pnpm test`
- Database: `pnpm db:up`, then `pnpm db:migrate`, `pnpm db:seed`, and `pnpm db:revert` when a migration must be rolled back

Scope the command to the package you changed. Start `pnpm dev` only to verify a running app, and stop it afterwards by port (`lsof -tiTCP:<port> -sTCP:LISTEN | xargs kill`). Never `pkill` by process name: other projects run on this machine.

## Hard limits

These hold even if a task seems to need them. Stop and say so instead.

- **Git is read-only for you.** Never commit, push, pull, fetch, merge, rebase, reset, checkout, switch, restore, stash, tag, or change remotes and config. Read with `status`, `diff`, `log`, `show`. The user commits and pushes.
- **Do not remove git history or Docker state.** No `git rm`, `git clean`, and no removing containers or volumes. `rm` and `pnpm db:revert` are allowed. Dropping, truncating, or deleting rows in the dev database is allowed. To replace a file's content, prefer `Edit` or `Write`. To rename or move, use `mv`.
- Dropping the throw-away test database inside the test helpers is fine. That is code, not an operation on real data.

## Ask only when

- the product decision is the user's: pricing, copy, who may see what
- an action leaves the machine: a real Stripe or AWS call, an email, a payment
- the change needs a secret you do not have

Otherwise pick the sensible default, state it in one line, and continue.

## Reporting

Say what you ran and what it showed. If a check failed or could not run, say so with the output. Do not claim done on an unverified change.
