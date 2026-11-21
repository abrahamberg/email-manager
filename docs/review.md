# T25 security and code review

Reviewed area by area: HTTP/auth, mail adapters and OAuth, pipeline and AI prompts,
store/SQL, setup, web. Severity: H high, M medium, L low.

## Fixed

| # | Sev | Finding | Fix |
|---|-----|---------|-----|
| 1 | H | **CSRF.** oauth2-proxy authenticates by cookie and `parseBody` read JSON whatever the content type, so a cross-site `text/plain` form post could change settings, rules or policies. | `http/csrf.ts` on `/api/*`: POST/PUT/PATCH must be `application/json` (cannot be sent cross-site without a CORS preflight, which is never answered), and any `Sec-Fetch-Site` other than `same-origin` is refused. Plus a 64 KB body limit (`hono/body-limit`). Tests in `test/http/csrf.test.ts`. |
| 2 | H | **Forged Authentication-Results.** All A-R headers were merged with "any pass wins", so a sender could add `dmarc=pass` and get past the DMARC-fail junk check. | Only the topmost header (the receiving server's) is read. |
| 3 | H | **Panel dry-run did nothing.** "Pause automation" and the Settings switch saved `settings.dryRun`, but runs only read the `DRY_RUN` env, so the mailbox kept changing. | `RunDeps.pausedInPanel` is read inside the lock; either side can turn dry-run on. The panel cannot lift an env `DRY_RUN=true`. |
| 4 | M | **SSRF via DNS in setup.** `isPublicHost` checked only the name, so a public name pointing at a cluster IP (or rebinding between check and connect) got through. | `setup/publicAddress.ts` resolves the name, requires every answer to be public (IPv4 private/CGNAT/multicast, IPv6 outside 2000::/3, mapped, NAT64, 6to4), and `pinnedImap` connects to that IP with the name kept as TLS `servername`, so the certificate is still checked against the name. |
| 5 | M | **STARTTLS stripping.** With `secure: false` (IMAP not on 993, SMTP 587), imapflow and nodemailer fall back to cleartext if the STARTTLS offer is stripped, which sends the password in the clear. | IMAP sets `doSTARTTLS: true` and SMTP `requireTLS: true` unless `allowPlaintext` (used only by the GreenMail tests). |
| 6 | L | Model-written triage text (`why`, `need`, fact title/detail/place) had no length cap despite the comment saying limits apply after parsing. | Capped in `toTriage`; facts with an empty title are dropped. |
| 7 | L | `cosine` was copied four times (life, search, store/embeddings, streams) with different handling of mismatched lengths (one read past the end and returned NaN). | One `search/cosine.ts`; vectors of different sizes score 0. |

## Checked, no change needed

- **Untrusted email content.** It cannot choose recipients (the draft goes to From, or to Reply-To only on the same domain; `headerValue` strips CR/LF), URLs (the server never fetches a link from mail; unsubscribe only records state), folders (moves are limited to the `junk | archive` roles; labels come from rules or the user's own area names, cleaned by `toKeyword`) or actions (the tier only picks among keep, label or digest; `delete` does not exist). Prompts put the email inside `<untrusted_email>`, quoted, with the tag neutralised. Every model output goes through zod (`structuredCall`), and ids are checked against the context (`areaId`). The Ask answer is rule-based and its proposals are fixed actions.
- **Auth.** `requireAllowedUser` is registered before every `/api` route (runs, connect, setup, api, and the 404 for unknown paths). `/healthz` and the static SPA are outside it on purpose: they carry no data, and the ingress puts oauth2-proxy (`auth-url` plus `auth-response-headers`, which overwrites any client copy of the header) in front of every path. The internal bearer is compared as SHA-256 digests with `timingSafeEqual`, and internal routes are never mounted on the public app.
- **OAuth.** PKCE S256, a random state in an HMAC-signed, path-scoped, httpOnly, SameSite=Lax cookie with a 10-minute TTL, deleted on callback. Token responses are zod-validated. Refresh tokens are sealed with AES-256-GCM, a random 12-byte IV and a 16-byte tag, and the cookie key is derived separately.
- **Secrets and bodies.** Logs carry only error names, counts and request ids. Only compact text, headers and summaries are stored. Setup passwords are used for one call and never echoed.
- **SQL.** Every query is parameterised. The one interpolated column (`senders.bump`) comes from a fixed union.
- **Feeds.** https only, a host allowlist checked on every redirect hop, a byte cap, a timeout, a pinned sha256 or Ed25519 signature, and zod rules with `source` forced to `feed`.
- **Web.** No `dangerouslySetInnerHTML` and no hrefs built from mail data. CSP `default-src 'self'; frame-ancestors 'none'`.

## Not fixed (with reason)

| Sev | Finding | Why left |
|-----|---------|----------|
| L | Facts are dropped when triage gives no area. | Decided to keep this and document it: `facts.area_id` is `NOT NULL REFERENCES areas` and `Fact.areaId: string` is a contract. Keeping them needs a migration and a contract change, with no security gain. The panel shows facts per area only, so an unsorted fact would have nowhere to appear yet. |
| L | The GreenMail image tag `greenmail/standalone:2.1.3` in `.github/workflows/ci.yml` is unverified. | Not checked from here; left as is. |
| L | The token ciphertext is not bound to its provider (no GCM AAD). | Swapping blobs needs write access to the DB. Adding AAD would make existing stored tokens unreadable. |
| L | The cursor moves past a message whose processing threw, so a transient IMAP error leaves it unprocessed (still in the inbox, never lost). | Deliberate, so a poison message cannot block runs. The error is recorded on the run. |
| L | Pending-action and run errors store `err.message` (up to 200 chars), which can include IMAP server text. | It has no body or secret content and is useful for debugging. |
| L | `Origin` is not compared with the host. | Sec-Fetch-Site plus the JSON content type already cover it, and comparing hosts behind the ingress would need the public URL in every deployment. |
| L | `aiExtract` `closes` is a free string up to 40 chars, not a validated date. | Shown as text only. |
| L | The worker log prints the env `DRY_RUN`, not the effective value after `pausedInPanel`. | Cosmetic. |
| L | The Ask unsubscribe text says it uses "List-Unsubscribe links", but the action only marks the senders unsubscribed in the digest. | A wording issue for the UX side; nothing is fetched, which is the safe behaviour. |
| info | The kube manifests have no egress NetworkPolicy. | Outside this repo. The setup host pinning (#4) covers the panel-driven connection. |
