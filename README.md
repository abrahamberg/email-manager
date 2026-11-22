# email-manager

A lightweight, scheduled email manager: rules and spam checks first, AI only where needed.
It filters spam and repetitive mail, drafts or sends replies where safe, and turns mail that needs attention into tasks.

Status: mock approved, build planned. See [docs/design.md](docs/design.md) and [docs/plan.md](docs/plan.md).

## Control panel mock

`web/` is a clickable React + TypeScript mock of the control panel with mock data (no backend yet).
The UX thinking behind it is in [docs/ux.md](docs/ux.md).

```sh
cd web
npm install
npm run dev     # http://localhost:5173
npm test
```

## Deploying

The server and the worker CronJob read only two secrets from env: `DATABASE_URL` and `OPENAI_API_KEY`.
Plain config: `ALLOWED_EMAILS`, and `PUBLIC_URL` for Office 365 / Gmail sign-in. Mount one RWX volume at
`/data` (or set `DATA_DIR`) in both; the instance keys are created there on first start. Add mailboxes in
the panel under Set up. See the secrets notes in [docs/design.md](docs/design.md#35-deployment-on-kubernetes).
