# Finish only after test and review

Before you report the task done:

1. Run the tests for every package you touched. Run lint and typecheck when types or a public API changed.
2. Read the diff as a reviewer:
   - the behavior matches the request
   - a test fails if the new logic is removed
   - no unused exports, debug logs, or commented-out code
   - controller, service, repository, and port boundaries still hold
   - errors are explicit
3. Fix what the review finds, then re-run the check that failed.

Say what you ran and what it showed. If a check could not run, name it and why.
