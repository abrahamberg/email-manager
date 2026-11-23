# Security policy

email-manager reads your mail and holds mailbox credentials, so security reports are
welcome and taken seriously.

## Reporting a vulnerability

Please **do not open a public issue**. Use GitHub's private reporting instead:
the repository's **Security** tab, then **Report a vulnerability**.

Include what you found, how to reproduce it, and the impact you expect. You should get
a first answer within a week. Once a fix is released you are credited in the release
notes, unless you prefer not to be.

## Supported versions

Only the latest image on `main` (`ghcr.io/abrahamberg/email-manager:latest` and its
`sha-*` tags) gets fixes.

## What the design relies on

Worth knowing when you deploy or review it:

- **The auth header.** The server trusts `X-Auth-Request-Email` from the proxy in front
  of it. Anyone who can reach port 8080 directly can claim to be any user. Keep it behind
  the proxy (NetworkPolicy, private network). See the README's Authentication section.
- **The internal port** (8081) triggers runs with a bearer token. Never expose it.
- **The data volume** holds the key that seals mailbox secrets (AES-256-GCM). Anyone with
  the volume and a database dump can read them; losing the volume makes them unreadable.
- **Email is untrusted input.** It never chooses recipients, URLs, folders or actions,
  and it reaches the model only inside a quoted, delimited block. Model output is
  validated before use. See [docs/review.md](docs/review.md) for the last review.
- **Bodies are not stored**, only headers, compact text and summaries. Secrets and bodies
  are never logged.
