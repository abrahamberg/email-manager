# Implementation plan

Status: **proposal, awaiting review.** It builds the backend behind the
approved mock (`web/`, `docs/ux.md`) along the architecture in `docs/design.md`.

## How the work is split

Each task is sized for **one fresh agent session**. It reads a short, named set
of files (usually 20k–60k tokens) and never the whole repo. That keeps every
session far below the 250k limit and avoids paying to reload context.

- **Contracts, not conversation.** Tasks hand off through small typed files:
  `shared/src/types.ts` (the API shapes the panel already uses) and
  `server/src/ports.ts` (interfaces such as `Mailbox`, `MailAuth`,
  `Classifier` and `Embedder`). A task reads the contracts plus its own inputs. It does not read
  other tasks' code.
- **One CLAUDE.md** at the repo root holds the code rules, commands and commit
  format. It loads automatically, so the rules are never repeated in prompts.
- **Model choice.** Sonnet is the default, for well-specified implementation,
  parsers, repos, routes, UI wiring and tests. Opus takes the tasks marked
  **O**: architecture and contracts, security boundaries, prompt and AI-safety
  design, and stateful or tricky logic. Opus also reviews Sonnet's work by
  reading the **diff only**, which is cheap.
- **Done means:** the listed checks pass (`npm test` and `npm run typecheck` in
  the touched workspaces), files stay under about 100 lines, and the task is
  ticked here in the same commit.

Legend: **O** = Opus, **S** = Sonnet. "Reads" is the complete list of files to
open. "Touches" is where the code goes.

## Phase 0: foundations

**T0 · O · Workspace, contracts and rules**
- Reads: `docs/design.md` §3–4, `web/src/domain/types.ts`, `web/package.json`.
- Touches: root `package.json` (npm workspaces `shared`, `server`, `web`),
  `tsconfig.base.json`, `CLAUDE.md`, `shared/src/types.ts` (moved from web; web
  re-exports it), `server/src/ports.ts`, `.github/workflows/ci.yml`.
- Done: CI runs typecheck and tests for all workspaces, and the web mock still
  builds and passes its 38 tests. `ports.ts` declares every port used below,
  with a one-line "why" for each.

## Phase 1: logic only, no AI (milestone 1)

These tasks only need T0, so most of them can run in parallel.

**T1 · S · Config**
- Reads: `CLAUDE.md`, `server/src/ports.ts`, design §3.5.
- Touches: `server/src/config.ts` (zod env schema; secrets never logged).
- Done: tests show a missing or invalid env fails fast with a clear message.

**T2 · S · Parse email**
- Reads: `CLAUDE.md`, `shared/src/types.ts` (EmailRef), `ports.ts`.
- Touches: `server/src/mail/Email.ts`, `parseEmail.ts`,
  `server/test/fixtures/*.eml` (about 12 anonymised samples: newsletter, job
  alert, invite, spoofed sender, HTML-only, non-UTF-8).
- Done: table tests over the fixtures.

**T3 · S · Header signals**
- Reads: `CLAUDE.md`, `Email.ts`, design §2.2–2.3.
- Touches: `server/src/spam/authResults.ts`, `server/src/lowValue/bulkHeaders.ts`.
- Done: pure and table-tested on the fixtures.

**T4 · S · Rules engine**
- Reads: `CLAUDE.md`, `web/src/domain/rules.ts` (logic to port), design §3.3.
- Touches: `server/src/rules/Rule.ts` (zod), `matchRules.ts`.
- Done: the same cases as `web/src/domain/rules.test.ts`, plus priority and expiry.

**T5 · O · Rule feeds (security)**
- Reads: `CLAUDE.md`, `Rule.ts`, design §3.3.
- Touches: `server/src/rules/fetchFeed.ts`, `verifyFeed.ts`.
- Done: tests prove that a feed is rejected on a host outside the allow-list,
  a bad signature or hash, a schema failure, or an oversize body, and that the
  previous version stays active. It never follows redirects off the allow-list.

**T6 · S · Spam check**
- Reads: `CLAUDE.md`, `ports.ts` (SpamCheck), `authResults.ts`.
- Touches: `server/src/spam/rspamdCheck.ts`, `isSpam.ts`.
- Done: tests with a fake HTTP server. If Rspamd is down, the email is never
  marked as spam on that basis.

**T7 · S · Low-value detection**
- Reads: `CLAUDE.md`, `bulkHeaders.ts`, design §2.3.
- Touches: `server/src/lowValue/isLowValue.ts`, `simhash.ts`.
- Done: pure, table-tested.

**T8 · O · Store (Postgres)**
- Reads: `CLAUDE.md`, `shared/src/types.ts`, `ports.ts`.
- Touches: `server/src/store/db.ts` (`postgres` driver), `migrations/*.sql`, a
  tiny migration runner, and one repo file per table (messages, outcomes, rules
  and rule versions, senders, runs, areas, facts, matters, streams and items,
  embeddings stored as `real[]`).
- Done: the repos are tested on in-process PGlite, so tests need no Docker.
  Bodies are never stored, only headers, compact text and summaries.

**Providers (decided):** generic IMAP/SMTP, Office 365 and Gmail are all
supported through one IMAP adapter and one SMTP sender. Only sign-in differs:
a password (or app password) for generic servers, and OAuth2 (XOAUTH2) for
Office 365 and Gmail, since Microsoft no longer accepts passwords for Exchange
Online IMAP and SMTP.

**T9 · O · IMAP adapter**
- Reads: `CLAUDE.md`, `ports.ts` (Mailbox, MailAuth), `Email.ts`.
- Touches: `server/src/mail/imapMailbox.ts`, `server/test/imap.int.test.ts`.
- Done: a GreenMail integration test in CI covers fetching since the last UID,
  a UIDVALIDITY change, moving to Junk, labelling, and appending a draft. Every
  operation is idempotent on retry. Sign-in comes from a `MailAuth` port, so
  the adapter doesn't know which provider it talks to.

**T9b · O · OAuth2 sign-in for Office 365 and Gmail (security)**
- Reads: `CLAUDE.md`, `ports.ts` (MailAuth), `config.ts`.
- Touches: `server/src/mail/auth/passwordAuth.ts`, `oauthAuth.ts`,
  `providers.ts` (host, port and scopes for Office 365 and Gmail),
  `routes/connect.ts`.
- Done: an authorization-code flow with PKCE starts from the panel's Set up
  step. The refresh token is stored encrypted, using a key from the Kubernetes
  Secret, and refreshed before it expires. Scopes are limited to IMAP and SMTP.
  Tests use a fake token endpoint and cover expiry, revocation and a wrong
  `state`.

**T9c · S · SMTP sender**
- Reads: `CLAUDE.md`, `ports.ts` (ReplySender, MailAuth).
- Touches: `server/src/mail/smtpSender.ts` (nodemailer, XOAUTH2 or password).
- Done: tests against GreenMail SMTP. It's used only once auto-send is turned
  on, because v1 saves drafts over IMAP.

**T10 · O · Pipeline**
- Reads: `CLAUDE.md`, `ports.ts`, design §3.1.
- Touches: `server/src/pipeline/processEmail.ts`, `outcomes.ts`, `runMailbox.ts`.
- Done: in-memory fakes prove the order (spam, then rules, then low-value, then
  AI) and that AI is not called when logic decides. Dry-run touches nothing. A
  second overlapping run is a no-op because of a Postgres advisory lock.

**T11 · O · HTTP and auth (security)**
- Reads: `CLAUDE.md`, `config.ts`, design §3.5.
- Touches: `server/src/http/app.ts`, `auth.ts`, `routes/runs.ts`, `server/src/main.ts`.
- Done: tests show that a request with no header gets 401, an email outside
  the allow-list gets 403, the internal run port needs a token and is a
  separate listener, and errors never echo secrets.

**T12 · S · Image and deploy manifests**
- Reads: `CLAUDE.md`, design §3.5, and in the kube repo `AGENTS.md`,
  `gitops/platformengr-portal/*` (the pattern to copy) and
  `gitops/victoria/victorialogs-ingress.yaml` (the oauth2-proxy annotations).
- Touches: `Dockerfile` (distroless, non-root, read-only root filesystem),
  `.github/workflows/image.yml` (push to GHCR as `sha-*`), and in the kube repo
  `gitops/email-manager/`: the ArgoCD Application, a Deployment (API and
  panel), a CronJob (the worker, same image), a small Rspamd Deployment and
  Service, an Ingress behind oauth2-proxy that forwards `X-Auth-Request-Email`,
  a NetworkPolicy, a ConfigMap, and an ExternalSecret on `bitwarden-store-cluster`.
- Done: `kubectl apply --dry-run=client` passes on every file. Opus reviews
  the NetworkPolicy and Ingress diff. Nothing is pushed to the kube repo
  before the Bitwarden items exist.

**Milestone 1 check:** a dry run against a real mailbox logs a sensible outcome
for every message.

## Phase 2: AI and the life layer (milestones 2–3)

**T13 · O · AI client**
- Reads: `CLAUDE.md`, `ports.ts` (Classifier), design §2.4 and §3.4.
- Touches: `server/src/ai/client.ts`, `compactEmail.ts`, `budget.ts`.
- Done: structured output is validated by zod, and anything invalid falls back
  to "keep". The daily budget is enforced. Prompts are cached. Email text is
  passed as quoted data and the model has no tools. Tests use recorded
  responses only.

**T14 · O · Triage into tiers**
- Reads: `CLAUDE.md`, `client.ts`, `shared/src/types.ts` (Decision, Fact, Area),
  `docs/ux.md` §1 and §6.
- Touches: `server/src/ai/triage.ts`, `prompts.ts`.
- Done: one cheap call per email returns the tier (don't miss, worth knowing,
  not worth your time), the area, the matter title and "need" line, and any
  facts. Tests run against recorded fixtures.

**T15 · O · Matters (many emails, one thing)**
- Reads: `CLAUDE.md`, `ports.ts` (Embedder), the store repos for matters.
- Touches: `server/src/life/assignMatter.ts`.
- Done: emails join a matter by thread first, then by known entity, then by
  nearest embedding over a threshold. Tests cover a follow-up joining its
  matter and an unrelated email staying separate.

**T16 · S · Embeddings**
- Reads: `CLAUDE.md`, `ports.ts` (Embedder).
- Touches: `server/src/search/localEmbedder.ts`, `vectorSearch.ts`.
- Done: a small local model runs in-process, so mail text never leaves the
  cluster and costs no tokens. Search is brute-force cosine over SQLite, which
  is fine at mailbox scale. Tests use a fake embedder.

**T17 · S · Streams (noisy senders, few good items)**
- Reads: `CLAUDE.md`, `shared/src/types.ts` (Stream, StreamItem), `ports.ts`,
  `docs/ux.md` "Noisy streams".
- Touches: `server/src/streams/detectStream.ts`, `splitItems.ts`, `parsers/*.ts`,
  `matchInterests.ts`.
- Done: a known-format parser (job alert) plus an AI fallback extract the
  items. Matching uses the area notes as interests, and "more" or "less"
  feedback shifts the weight. Tests run on the fixtures.

**T18 · S · Ask and facts**
- Reads: `CLAUDE.md`, `web/src/state/assistant.ts` (logic to port),
  `vectorSearch.ts`.
- Touches: `server/src/life/answerQuestion.ts`, `routes/ask.ts`.
- Done: the same cases as `web/src/state/assistant.test.ts`, with embeddings
  in place of the concept map. Every answer cites its source email.

**T19 · O · Replies (safety)**
- Reads: `CLAUDE.md`, `client.ts`, design §3.4, `shared/src/types.ts` (ReplyPolicy).
- Touches: `server/src/replies/draftReply.ts`, `replyPolicy.ts`.
- Done: `replyPolicy` is pure and table-tested. v1 saves drafts only. Tests
  show that a prompt-injection fixture cannot change the recipients, add links
  or trigger a send.

**T20 · S · Today payload**
- Reads: `CLAUDE.md`, `shared/src/types.ts` (AppData), the store repos.
- Touches: `server/src/http/routes/today.ts`, `server/src/life/buildReport.ts`.
- Done: it returns the same shape as `web/src/api/api.ts`, and a contract test
  validates it against the shared types.

**T21 · S · Proposals and trust**
- Reads: `CLAUDE.md`, `web/src/domain/autonomy.ts`, the rules and outcomes repos.
- Touches: `server/src/trust/*.ts`, `routes/delegation.ts`.
- Done: AI rule proposals are saved as `proposed`, and risky actions always
  wait for approval. It covers quick checks, accuracy per category, and the
  autonomy suggestions.

## Phase 3: panel on real data

**T22 · S · Real API client**
- Reads: `CLAUDE.md`, `web/src/api/api.ts`, `web/src/state/actions.ts`, `shared/src/types.ts`.
- Touches: `web/src/api/httpApi.ts`. The mock stays for development and tests.
- Done: one environment switch picks mock or HTTP, and every action posts to
  its endpoint.

**T23 · S · Action endpoints**
- Reads: `CLAUDE.md`, `web/src/state/actions.ts`, `shared/src/types.ts`.
- Touches: `server/src/http/routes/*.ts`.
- Done: one route per action group, with zod-validated bodies and tests.

**T24 · S · Real setup flow**
- Reads: `CLAUDE.md`, `web/src/pages/setup/*`, `routes/runs.ts`, `routes/connect.ts`.
- Done: Set up offers three choices: Office 365, Gmail, or another IMAP/SMTP
  server. The first two sign in with OAuth, the third with host, port and
  password. "Test connection" and "Learn from 30 days" (read-only) work against
  the server.

**T25 · O · Security and code review**
- Uses the `/security-review` and `/code-review` skills on the full diff since T0.
- Done: findings are fixed or written down with a reason.

## Order and parallelism

```
T0 → { T1, T2, T3, T4, T8 } → { T5, T6, T7, T9 } → T9b → T10 → T11 → T12   (milestone 1)
T9 → T9c
T13 → T14 → { T15, T16 } → { T17, T18 } ; T13 → T19 ; T8 → { T20, T21 }
{ T20, T21, T11 } → T22 → T23 → T24 → T25
```

By count, 16 of the 28 tasks are Sonnet and 12 are Opus. The Opus tasks are
the ones where a mistake is costly: contracts, the Postgres schema, IMAP state,
OAuth tokens, the pipeline, auth, feeds, AI safety and matter grouping.

## Keeping token use low

- Each task opens only the files listed under its "Reads". Large docs are read
  by section, never in full.
- A task ends by committing and ticking itself here. The next task starts a
  fresh session from the plan, so no long conversation gets reloaded.
- Opus reviews diffs, not whole files. Tests and fixtures carry the
  specification, so prompts stay short.
- At runtime, logic runs first. The AI sees compact text only, triage uses the
  small model, embeddings are local, and drafts use the bigger model only for
  the few emails that need a reply.

## Progress

- [x] T0 · [x] T1 · [x] T2 · [x] T3 · [x] T4 · [ ] T5 · [x] T6 · [x] T7 · [ ] T8 · [ ] T9 · [ ] T9b · [ ] T9c · [ ] T10 · [ ] T11 · [ ] T12
- [ ] T13 · [ ] T14 · [ ] T15 · [ ] T16 · [ ] T17 · [ ] T18 · [ ] T19 · [ ] T20 · [ ] T21
- [ ] T22 · [ ] T23 · [ ] T24 · [ ] T25
