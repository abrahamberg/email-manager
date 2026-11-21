# Email Manager: research and design proposal

Status: **proposal, for review**. Nothing is built yet.

## 1. Goal in one paragraph

A small service that runs on a schedule in Kubernetes, reads a mailbox, and
sorts every new message through a cheap-to-expensive pipeline: spam out,
low-value repetitive mail into a digest, mail that needs an answer gets a
reply (drafted or, where policy allows, sent), and mail that needs real
attention becomes a task. A React + TypeScript control panel behind the
existing oauth2-proxy shows what was done, why, and lets you undo it.

**Logic first, AI last.** Every step that can be decided by headers, rules or
an existing spam engine is decided there. Only what is left reaches the model,
and only a compact version of it.

## 2. Research: what exists and what we reuse

### 2.1 Mail access

| Option | Verdict |
|---|---|
| **IMAP** | Universal (Gmail, Outlook, Fastmail, self-hosted). Supports flags, moving, `APPEND` to Drafts, `CONDSTORE`/`UIDNEXT` for cheap incremental sync. **Chosen.** |
| JMAP | Cleaner protocol, but only Fastmail and Stalwart really offer it. Can be a second adapter later behind the same interface. |
| Gmail / Graph APIs | Provider-specific, more auth work. Not needed while IMAP works. |
| SMTP (sending) | Needed only for auto-send. Drafts go back over IMAP `APPEND`. |

Libraries (Node/TypeScript):

- **`imapflow`**: modern, promise-based, actively maintained (2.x line in
  2026), from the EmailEngine author. Handles IDLE, CONDSTORE, XOAUTH2.
- **`mailparser`**: same author; parses MIME into headers, text, html,
  attachments.
- **`nodemailer`**: SMTP for the auto-send path.

The same quality does not exist in one place in Go (`go-imap` v2 is still
settling) and Python's `imapclient` is good but would split the project into
two languages.

### 2.2 Spam detection: reuse, don't rewrite

| Source | What it gives | Cost to us |
|---|---|---|
| Provider headers (`Authentication-Results`, `X-Spam-*`) | SPF / DKIM / DMARC verdicts the provider already computed | A header parser, ~50 lines |
| **Rspamd** (sidecar container) | Full scanner: SpamAssassin-compatible rules, DNS blocklists, URI blocklists, Bayes, fuzzy hashes, phishing checks. One HTTP call (`POST /checkv2` with the raw message) returns a score and symbols. Its rule maps update themselves from rspamd.com. Learns from corrections via `/learnspam` / `/learnham`. | One container + one small HTTP client |
| Spamhaus ZEN / DBL | IP and domain blocklists. Spamhaus blocks queries that come through public resolvers, so use the free **Data Query Service (DQS)** key. Used by Rspamd, or directly by our fallback check. | Free DQS key |
| abuse.ch URLhaus | Malware URL / domain list, plain downloadable feed | Feed fetcher |
| SpamAssassin rules (`sa-update`) | Huge Perl-regex rule set. Re-implementing its engine is a project in itself. | Use through Rspamd instead |
| Sieve (RFC 5228) | Server-side filtering language. Good where the server supports ManageSieve, but Gmail and Outlook don't. | Not in v1. A possible export target for our own rules later. |

**Recommendation:** run Rspamd as a sidecar for maximum quality with almost no
code, behind a `SpamCheck` interface. If you'd rather not run it, a built-in
fallback (`Authentication-Results` + Spamhaus DQS + URLhaus) implements the
same interface. Most mailboxes at big providers are already spam-filtered, so
the larger value of this project is in the next layer.

### 2.3 Low-value, repetitive mail: mostly headers

No external library needed. Cheap, reliable signals:

- `List-Unsubscribe`, `List-Id`, `Precedence: bulk|list`,
  `Auto-Submitted`, `X-Auto-Response-Suppress` headers.
- Sender history from our own store: you never reply to or open this sender.
- Near-duplicate detection: a SimHash of the normalised text, compared with
  the last N messages from the same sender ("your weekly report" that is
  identical every week).
- Known notification senders (`noreply@`, `notifications@`).

These go to a **digest** (one summary per day), not the trash.

### 2.4 AI (Claude API)

- Official SDK `@anthropic-ai/sdk`.
- **Triage** (category, priority, one-line reason) uses **Claude Haiku 5.5**
  ($0.10 / $0.50 per million tokens), with structured JSON output validated by
  a schema.
- **Reply drafting** uses **Claude Sonnet 5.5** ($2 / $10), only for mail
  triaged as `needs_reply`. Models are config values, so this can change.
- Token economy:
  - Only mail that survived every logic step reaches the model.
  - `compactEmail()` sends plain text with quoted history, signatures, HTML and
    tracking links stripped, capped at ~2,000 characters, plus 5 headers.
  - The system prompt and rules summary sit in a stable prefix with prompt
    caching.
  - A run can use the Message Batches API (half price) since nothing is
    real-time.
  - Rough cost: 50 messages/day reaching triage is about 50k input tokens,
    well under one cent a day. Drafts are about $0.01 each.
  - A per-run and per-day token budget in config; the run stops calling the
    model when it is hit.

### 2.5 Backend language

**TypeScript on Node.js 22 LTS.** One language with the React panel, shared
types between API and UI, and the best IMAP/MIME libraries of any ecosystem.
`zod` validates every boundary (config, rules, feeds, AI output, HTTP input).

Runtime dependencies kept to: `imapflow`, `mailparser`, `nodemailer`,
`@anthropic-ai/sdk`, `zod`, `hono` (tiny typed HTTP server), and SQLite
(`node:sqlite`, built in; `better-sqlite3` if it proves unstable).
Tests: `vitest`. Frontend: React, Vite, TypeScript, no UI kit.

## 3. Architecture

### 3.1 The pipeline reads like the spec

```ts
export async function processEmail(email: Email, deps: Deps): Promise<Outcome> {
  if (await isSpam(email, deps.spamChecks)) return moveToJunk(email, deps);

  const ruleAction = matchRules(email, deps.rules);
  if (ruleAction) return applyRuleAction(ruleAction, email, deps);

  if (isLowValue(email, deps.senderHistory)) return addToDigest(email, deps);

  const triage = await triageWithAi(compactEmail(email), deps.ai);
  return handleTriage(triage, email, deps);
}

function handleTriage(triage: Triage, email: Email, deps: Deps): Promise<Outcome> {
  switch (triage.category) {
    case "needs_reply":  return replyOrDraft(email, triage, deps);
    case "needs_action": return createTask(email, triage, deps);
    case "low_value":    return addToDigest(email, deps);
    case "spam":         return moveToJunk(email, deps);
    default:             return keepInInbox(email, deps);
  }
}
```

Every step is a small named function in its own file. Every `Outcome` is
written to an activity log with the reason (which rule, which spam symbol,
what the AI said), which is what makes undo and trust possible.

### 3.2 Principles applied

- **Functional core, imperative shell.** Rule matching, low-value detection,
  reply policy and email compaction are pure functions: plain data in, plain
  data out, tested without mocks. IMAP, HTTP, SQLite and Claude live in
  adapters at the edge.
- **Ports and adapters (dependency inversion).** The pipeline depends on small
  interfaces: `Mailbox`, `SpamCheck`, `Classifier`, `RuleSource`, `TaskStore`,
  `ReplySender`. `main.ts` is the only file that wires concrete classes.
  Adding JMAP or a new spam engine means one new file, no edits elsewhere
  (open/closed).
- **One responsibility per file**, files kept short (target under ~100 lines),
  so you open a file only when you change that behaviour.
- **Rules are data, not code.** Easy to download, diff, review, and for the
  AI to propose.
- **Comments only for the why**, not for what the code already says.

### 3.3 Rules

```ts
const Rule = z.object({
  id: z.string(),
  source: z.enum(["feed", "user", "ai"]),
  when: z.array(Condition),        // e.g. { field: "from", op: "endsWith", value: "@news.example.com" }
  then: Action,                    // junk | digest | archive | label | task | keep
  priority: z.number().int(),
  status: z.enum(["active", "proposed", "disabled"]),
  expiresAt: z.string().datetime().optional(),
});
```

- **Downloaded rules:** `RuleSource` entries in config, each with an HTTPS URL
  on an allow-listed host and a pinned SHA-256 or minisign signature. A feed
  that fails verification or the schema is rejected and the previous version
  stays in use. Every version is stored, so it can be diffed and rolled back.
- **AI-updated rules:** when triage sees a pattern ("this sender is always a
  newsletter"), it returns a suggested rule. The suggestion is validated by the
  same schema and saved as `proposed`. Low-risk actions (`digest`, `label`)
  can be auto-activated if you turn that on. Risky ones (`junk`, anything that
  allow-lists a sender, anything that sends) always wait for approval in the
  panel. The AI can never write rules that delete mail.

### 3.4 Replies: safety first

Email content is untrusted input and can contain prompt injection. So:

- The model gets the email as quoted data and **has no tools**. It returns
  text and a structured verdict, nothing else.
- `replyPolicy()` is a pure function that decides draft vs send. Auto-send
  only when **all** hold: the category is on an allow-list you control (e.g.
  "acknowledge receipt", "confirm a proposed meeting time"), the sender is a
  known contact you have written to before, model confidence is high, the
  reply adds no links or attachments, and the daily send cap is not reached.
- Otherwise the reply is saved to **Drafts** over IMAP and a task "review
  draft" is created.
- **v1 ships drafts-only.** Auto-send is a switch you turn on later.
- A **dry-run mode** logs every decision without touching the mailbox. It is
  the default on first deploy.

### 3.5 Deployment on Kubernetes

```
            oauth2-proxy (existing)
                   │  X-Auth-Request-Email
                   ▼
 ┌──────────── Deployment (1 replica) ───────────────┐
 │  email-manager: API + static React panel          │
 │  rspamd sidecar (localhost:11333)                 │
 │  SQLite on a PVC                                  │
 └───────────────────────────────────────────────────┘
                   ▲  POST /internal/runs (token, cluster-only port)
            CronJob (every N minutes, curl image)
```

- The CronJob triggers a run instead of running its own worker, so there is a
  **single writer** to SQLite and no shared-volume problems. One image, one
  process. If the cluster already has Postgres, the worker could run in the
  CronJob directly instead; that is open question 5.
- A run takes a lock, so overlapping triggers do nothing.
- **Auth:** the app trusts the user header only because a NetworkPolicy lets
  ingress reach the public port from the oauth2-proxy alone. Middleware
  requires the header and checks it against `ALLOWED_EMAILS`. The internal run
  port is not exposed through the ingress and needs a shared token.
- Secrets (IMAP password or OAuth token, Anthropic key, DQS key) come from a
  Kubernetes Secret, never logged.
- Container: distroless Node image, non-root, read-only root filesystem.
- Stored data is minimal: headers, the compact text used for decisions,
  summaries and the activity log. Full bodies stay in the mailbox.

### 3.6 Control panel (React + TypeScript)

Built around decisions, not around a folder list:

- **Needs you**: tasks and drafts waiting for approval, one keystroke each
  (approve, edit, snooze, dismiss).
- **Handled for you**: everything the system did today, each with its reason
  and an Undo. Undoing a spam or digest decision feeds back into Rspamd
  learning or proposes a rule fix.
- **Digest**: low-value mail grouped by sender, one line each.
- **Rules**: active rules, feeds and their versions, and an inbox of AI
  proposals to approve or reject.
- **Runs**: run history, counts per outcome, tokens and cost.

## 4. File layout

```
email-manager/
├── server/
│   ├── src/
│   │   ├── main.ts                 # composition root: wires adapters
│   │   ├── config.ts               # env → typed config (zod)
│   │   ├── pipeline/
│   │   │   ├── runMailbox.ts       # fetch new mail since last UID, process each
│   │   │   ├── processEmail.ts     # the readable flow in §3.1
│   │   │   └── outcomes.ts         # moveToJunk, addToDigest, createTask...
│   │   ├── mail/
│   │   │   ├── Email.ts            # domain type
│   │   │   ├── Mailbox.ts          # port
│   │   │   ├── imapMailbox.ts      # imapflow adapter
│   │   │   └── parseEmail.ts       # mailparser → Email
│   │   ├── spam/
│   │   │   ├── isSpam.ts
│   │   │   ├── authResults.ts      # SPF/DKIM/DMARC from headers
│   │   │   └── rspamdCheck.ts
│   │   ├── rules/
│   │   │   ├── Rule.ts             # schema
│   │   │   ├── matchRules.ts       # pure
│   │   │   ├── fetchFeed.ts
│   │   │   └── verifyFeed.ts
│   │   ├── lowValue/
│   │   │   ├── isLowValue.ts
│   │   │   ├── bulkHeaders.ts
│   │   │   └── simhash.ts
│   │   ├── ai/
│   │   │   ├── compactEmail.ts     # pure: strip and cap
│   │   │   ├── triageWithAi.ts
│   │   │   ├── draftReply.ts
│   │   │   └── prompts.ts
│   │   ├── replies/replyPolicy.ts  # pure: draft or send
│   │   ├── store/                  # SQLite: db.ts, migrations/, one repo per table
│   │   └── http/                   # app.ts, auth.ts, routes/*.ts
│   └── test/
│       ├── fixtures/*.eml          # real-world samples, anonymised
│       └── *.test.ts
├── web/
│   └── src/
│       ├── api/                    # typed client, types shared with server
│       ├── pages/                  # NeedsYou, Handled, Digest, Rules, Runs
│       └── components/
├── deploy/k8s/                     # deployment, cronjob, service, networkpolicy, pvc
├── Dockerfile
└── docs/design.md
```

## 5. Testing

- **Pure functions** (rules, low-value, reply policy, compaction, feed
  verification) get table-driven unit tests over `.eml` fixtures. This is
  where most of the logic, and most of the tests, live.
- **The pipeline** is tested with in-memory fakes of the ports: given this
  email and these rules, the outcome is X and the model was or wasn't called.
- **The IMAP adapter** gets a small integration test against GreenMail (an
  IMAP test server in a container) in CI.
- **AI calls** are tested by schema: a recorded response must validate, an
  invalid one must fall back to "keep in inbox". No live model calls in CI.
- No snapshot tests and no coverage target for its own sake.

## 6. Milestones

1. **Logic only:** IMAP read, rules, spam check, low-value digest, activity
   log, dry-run mode, Kubernetes manifests. No AI.
2. **AI triage and tasks**, plus the panel's Needs you, Handled and Digest
   views.
3. **Replies (drafts), AI rule proposals, rule feeds**, Rules and Runs views.
4. Optional: auto-send, JMAP adapter, Sieve export, task export.

## 7. Open questions

1. ~~Which mail provider(s)?~~ **Decided:** all of them. Generic IMAP/SMTP
   with a password, plus Office 365 and Gmail over OAuth2 (XOAUTH2), behind one
   `MailAuth` port (plan tasks T9, T9b, T9c).
2. Is running Rspamd as a sidecar fine, or do you prefer the built-in fallback
   only?
3. Agree that v1 is drafts-only, with auto-send later?
4. Should tasks live only in the panel, or also be pushed somewhere (GitHub
   issues, Todoist, a calendar)?
5. Is there a Postgres on the cluster you'd like to use, or is SQLite on a PVC
   fine?
6. One mailbox or several?

## Sources

- imapflow: https://socket.dev/npm/package/imapflow/overview/2.10.0
- Rspamd protocol (`/checkv2`): https://docs.rspamd.com/developers/protocol
- Rspamd controller endpoints (learning): https://docs.rspamd.com/developers/controller_endpoints/
- Spamhaus DQS and public resolvers: https://www.spamhaus.com/resource-center/successfully-accessing-spamhauss-free-block-lists-using-a-public-dns/
- JMAP software and providers: https://jmap.io/software/
