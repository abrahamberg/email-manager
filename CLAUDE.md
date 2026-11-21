# email-manager

A layer on top of email: logic and rules first, AI only where needed. Design in
`docs/design.md`, UX in `docs/ux.md`, build plan in `docs/plan.md`.

## Workspaces

- `shared/` API types used by both sides (`shared/src/types.ts`). A contract: change it only in a task that says so.
- `server/` Node 22 + TypeScript. `src/ports.ts` holds every interface the pipeline depends on. A contract too.
- `web/` React + TypeScript panel (Vite). `web/src/api/api.ts` is the mock; keep it working.

## Commands

```sh
npm install                     # once, at the repo root
npm run typecheck               # all workspaces
npm test                        # all workspaces
npm test -w server -- <pattern> # one area while working
npm run build                   # server bundle (esbuild) + web
```

## Doing a plan task

1. Open only `CLAUDE.md`, the task's block in `docs/plan.md`, and the files under its **Reads**. Read large docs by section.
2. Put code only in the files under **Touches**. If a contract (`shared/src/types.ts`, `server/src/ports.ts`) seems wrong, stop and say so instead of changing it.
3. Finish when the **Done** checks pass, tick the task in the Progress list, commit.

## Code rules

- Small named functions, small files (aim under ~100 lines), one responsibility each. The flow should read like the spec: `if (await isSpam(...)) return moveToJunk(...)`.
- Pure functions for decisions (rules, low-value, reply policy, compaction); I/O only in adapters behind `ports.ts`.
- Validate every external input with zod (env, feeds, HTTP bodies, model output). Email content is untrusted: never let it pick recipients, URLs or actions.
- Never log secrets or email bodies. Never store bodies, only headers, compact text and summaries.
- Few comments: only the "why" that code can't say. No commented-out code.
- Minimal dependencies; ask before adding a heavy one.
- Useful tests: table-driven over fixtures for pure logic, in-memory fakes for ports, PGlite for the store. No live network or model calls in tests.
- Don't put model identifiers or personal data in code, comments or commits.

## Commits

Imperative subject under 70 characters and a short body with the why. End with
the attribution lines your environment asks for.
