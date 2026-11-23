# Contributing

Thanks for helping. Issues and pull requests are welcome; for anything bigger than a
fix, open an issue first so we can agree on the approach.

## Setup

Node 22 and npm. Docker helps for Postgres and the IMAP integration test.

```sh
npm install
npm run typecheck              # all workspaces
npm test                       # all workspaces
npm test -w server -- <pattern> # one area while working
npm run dev -w web             # panel with mock data
npm run build                  # server bundle + web
```

The IMAP integration test runs against [GreenMail](https://greenmail-mail-test.github.io/greenmail/)
when the `GREENMAIL_*` variables are set; see `.github/workflows/ci.yml` for the values.

## Layout

- `shared/` API types used by the server and the panel (`shared/src/types.ts`).
- `server/` Node + TypeScript. `src/ports.ts` holds every interface the pipeline depends
  on; adapters (IMAP, SMTP, Postgres, OpenAI, Rspamd) implement them.
- `web/` React + TypeScript panel (Vite). `web/src/api/api.ts` is the mock; keep it working.
- `deploy/` Helm chart, Kustomize manifests and Docker Compose.
- `docs/` design, UX and review notes.

`shared/src/types.ts` and `server/src/ports.ts` are contracts between the two sides.
Change them only on purpose, and say so in the pull request.

## Code style

- Small named functions and small files (aim under ~100 lines), one responsibility each.
  The pipeline should read like the spec:
  `if (await isSpam(email)) return moveToJunk(email)`.
- Decisions (rules, low-value detection, reply policy) are pure functions. I/O lives in
  adapters behind `ports.ts`.
- Validate every external input with zod: env, feeds, HTTP bodies and model output.
- Email content is untrusted. It must never pick recipients, URLs or actions.
- Never log secrets or email bodies. Never store bodies.
- Few comments: only the "why" the code cannot say. No commented-out code.
- Minimal dependencies. Ask in an issue before adding a heavy one.

## Tests

- Table-driven tests over fixtures for pure logic, in-memory fakes for ports, PGlite
  for the store.
- No live network or model calls in tests.
- A bug fix comes with a test that fails without it.

## Commits and pull requests

- Imperative subject under 70 characters, and a short body with the why.
- Keep pull requests focused. CI (typecheck, tests, build, a smoke test of the bundle,
  and a render of the deploy files) must pass.
- By contributing you agree your work is released under the [MIT license](LICENSE).
