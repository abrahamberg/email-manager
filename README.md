# email-manager

A lightweight email manager that runs on a schedule next to your mailbox.
Rules and spam checks go first and AI only gets what is left, so it stays cheap.

- **Filters** spam (header checks, DMARC, optional [Rspamd](https://rspamd.com)) and
  low-value, repetitive mail into a digest.
- **Drafts replies** for mail that can be answered, as drafts in your own mailbox.
- **Turns mail that needs you into decisions** on a "Today" page: one card at a
  time, with the answer already prepared, and an undo for everything it did.
- **Learns your life areas** (work, school, home...) and answers questions like
  "when is my tire change?" from your mail, with the source email.
- **Works with any mailbox**: IMAP/SMTP with a password, Office 365 and Gmail
  with OAuth. Add as many as you like in the panel.

It starts in **dry-run mode**: it shows what it would do and touches nothing
until you switch that off.

## How it fits together

```
 browser ──► auth proxy ──► server :8080 (panel + API) ──► Postgres
            (oauth2-proxy,   server :8081 (internal run trigger, never exposed)
             Caddy, ...)     worker (CronJob or the server's own timer) ──► IMAP / SMTP, OpenAI
```

- **One image**, two entry points: `dist/main.js` (server) and `dist/worker.js` (one run).
- **Postgres** holds everything: headers, compact text, summaries and the activity log.
  Full bodies stay in your mailbox.
- **A small data volume** at `/data` holds two instance keys created on first start
  (the key that seals mailbox passwords and tokens, and the internal run token) and the
  local embedding model cache. **Back it up**: losing the key makes saved mailboxes unreadable.
- **No built-in login.** The app trusts the `X-Auth-Request-Email` header from an
  authenticating proxy in front of it, and checks it against `ALLOWED_EMAILS`. Nothing
  else may be able to reach port 8080. See [Authentication](#authentication).

## Choose a setup

| You have | Use |
|---|---|
| A Kubernetes cluster and Helm | [Helm chart](#kubernetes-with-helm) |
| A cluster, no Helm (or you prefer plain YAML) | [Kustomize / plain manifests](#kubernetes-with-kustomize-or-plain-manifests) |
| A GitOps repo (Argo CD, Flux) | [GitOps](#gitops-argo-cd-or-flux) |
| One server or a laptop with Docker | [Docker Compose](#docker-compose) |
| You want to hack on it | [Local development](#local-development) |

Every setup needs:

1. **Postgres 14 or newer** (no extensions needed). One empty database.
2. **An OpenAI API key** (optional). Without it the rules and spam checks still run,
   but there is no AI triage, no drafts and no learning.
3. **An authenticating proxy** that sets `X-Auth-Request-Email`.

## Kubernetes with Helm

The chart is in [`deploy/helm/email-manager`](deploy/helm/email-manager). Create the
Secret first (or let the chart create it from values, fine for a trial):

```sh
kubectl create namespace email-manager
kubectl -n email-manager create secret generic email-manager \
  --from-literal=database-url='postgres://user:password@postgres:5432/email' \
  --from-literal=openai-api-key='sk-...'
```

Then install, here behind ingress-nginx with oauth2-proxy already running on the cluster:

```sh
git clone https://github.com/abrahamberg/email-manager && cd email-manager
helm install email-manager deploy/helm/email-manager -n email-manager -f my-values.yaml
```

```yaml
# my-values.yaml
allowedEmails: "you@example.com"          # or "@example.com" for a whole domain
publicUrl: "https://email.example.com"    # needed for Office 365 / Gmail sign-in
secrets:
  existingSecret: email-manager
image:
  tag: sha-abc1234                        # pin a tag from the GitHub packages page
ingress:
  enabled: true
  className: nginx
  host: email.example.com
  tlsSecretName: email-manager-tls
  annotations:
    nginx.ingress.kubernetes.io/auth-url: "https://$host/oauth2/auth"
    nginx.ingress.kubernetes.io/auth-signin: "https://$host/oauth2/start?rd=$escaped_request_uri"
    nginx.ingress.kubernetes.io/auth-response-headers: "X-Auth-Request-Email"
networkPolicy:
  enabled: true
  allowFrom:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: ingress-nginx
```

Open the host, go to **Set up**, add a mailbox, and watch a few runs before setting
`dryRun: false`.

Useful values (all in [`values.yaml`](deploy/helm/email-manager/values.yaml)):

| Value | Default | What it does |
|---|---|---|
| `schedule.mode` | `cronjob` | `cronjob` runs the worker as a CronJob on `schedule.cron`. `inProcess` lets the server run itself every `schedule.intervalMinutes` (no CronJob, no shared volume). |
| `persistence.accessMode` | `ReadWriteMany` | In `cronjob` mode the server and the job both mount the data volume. With only `ReadWriteOnce` storage, use `inProcess`, or keep both on one node. |
| `persistence.enabled` | `true` | Off: put `token-encryption-key` (base64 of 32 random bytes) and `internal-token` (32+ chars) in your Secret; the model then downloads on every start. |
| `secrets.existingSecret` | `""` | Keys: `database-url`, and optionally `openai-api-key`, `token-encryption-key`, `internal-token`. |
| `rspamdUrl` | `""` | Use a running Rspamd, e.g. `http://rspamd:11333`. |
| `ai.triageModel`, `ai.draftModel` | built-in default | Override the OpenAI models. |
| `aiDailyBudgetUsd` | `0.5` | Hard daily cap on AI spend. |

The pods run as non-root with a read-only root filesystem and no service account token.

## Kubernetes with Kustomize or plain manifests

[`deploy/kustomize/base`](deploy/kustomize/base) holds plain manifests (Deployment,
Service, CronJob, PVC). [`overlays/example`](deploy/kustomize/overlays/example) adds a
namespace, an oauth2-proxy Ingress, a NetworkPolicy and your settings:

```sh
cp -r deploy/kustomize/overlays/example my-overlay   # keep it next to base, or fix the path
# edit my-overlay/kustomization.yaml (ALLOWED_EMAILS, PUBLIC_URL, image tag) and ingress.yaml (host)
kubectl create namespace email-manager
kubectl -n email-manager create secret generic email-manager \
  --from-literal=database-url='postgres://...' --from-literal=openai-api-key='sk-...'
kubectl apply -k my-overlay
```

Without kustomize, `kubectl kustomize my-overlay > email-manager.yaml` gives you one
plain file to review and `kubectl apply -f`.

## GitOps (Argo CD or Flux)

Point your tool at the chart in this repo, or at your own overlay. An Argo CD example:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: email-manager
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/abrahamberg/email-manager
    targetRevision: main                  # or a tag
    path: deploy/helm/email-manager
    helm:
      valuesObject:
        allowedEmails: "you@example.com"
        publicUrl: "https://email.example.com"
        secrets: { existingSecret: email-manager }
        image: { tag: sha-abc1234 }
  destination:
    server: https://kubernetes.default.svc
    namespace: email-manager
  syncPolicy:
    automated: { prune: true, selfHeal: true }
    syncOptions: [CreateNamespace=true]
```

- Keep the Secret out of git: create it with External Secrets, Sealed Secrets or SOPS,
  using the keys listed above.
- The data PVC has `helm.sh/resource-policy: keep`. With Argo CD also set
  `persistence.annotations: { argocd.argoproj.io/sync-options: "Prune=false,Delete=false" }`
  (or use `persistence.existingClaim` with a claim you manage) so a prune never deletes the keys.
- Flux: a `GitRepository` for this repo plus a `HelmRelease` with
  `chart.spec.chart: ./deploy/helm/email-manager` works the same way.

## Docker Compose

[`deploy/compose`](deploy/compose) runs Postgres, the app and [Caddy](https://caddyserver.com)
as the login (basic auth). The app runs itself every `RUN_INTERVAL_MINUTES`.

```sh
cd deploy/compose
cp .env.example .env
docker run --rm caddy:2 caddy hash-password --plaintext 'your password'
# put the hash, your email (PANEL_USER) and a database password into .env
docker compose up -d
```

Open http://127.0.0.1:8080 and log in with your email and password.

- **On a server with a domain:** set `SITE_ADDRESS=email.example.com`,
  `PUBLIC_URL=https://email.example.com`, and publish `80:80` and `443:443` for Caddy
  instead of `LISTEN`. Caddy then gets a certificate by itself.
- **Your own Postgres:** remove the `db` service and set `DATABASE_URL` on `app`.
- **Build from source** instead of pulling the image: `docker compose up -d --build`.
- **Back up** the `data` volume (instance keys) and the `db` volume.

## Local development

Node 22 and npm. The panel runs against mock data, no backend needed:

```sh
npm install
npm run dev -w web          # http://localhost:5173, mock data
npm run typecheck && npm test
```

To run the real server you need a Postgres and the auth header. For example:

```sh
docker run -d --name pg -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:18
npm run build
DATABASE_URL=postgres://postgres:dev@localhost:5432/postgres ALLOWED_EMAILS=me@example.com \
  DATA_DIR=.data STATIC_DIR=web/dist EMBEDDING_CACHE_DIR=.data/models node server/dist/main.js
curl -H 'X-Auth-Request-Email: me@example.com' localhost:8080/api/runs
```

For the panel in a browser, use the Compose setup with `--build`, or a header-setting
browser extension pointed at `localhost` only. Tests use PGlite and fakes; the IMAP
integration test runs only when the `GREENMAIL_*` variables are set (CI sets them).

## Authentication

The server never shows a login page. It reads the signed-in user from the
`X-Auth-Request-Email` header and allows only addresses (or `@domain`s) in
`ALLOWED_EMAILS`. That is safe only when:

1. the proxy **sets or overwrites** the header on every request (a client must never be
   able to send its own), and
2. **nothing but the proxy** can reach port 8080 (a NetworkPolicy, a private Docker
   network, a firewall).

Proxies that do this:

- **oauth2-proxy** with ingress-nginx: the annotations in the Helm example. With
  oauth2-proxy as a reverse proxy instead, use `--pass-user-headers` (or
  `--set-xauthrequest`) and `--upstream=http://email-manager`.
- **Caddy, Traefik or nginx with basic auth**, copying the user name (your email) into
  the header, as in [`deploy/compose/Caddyfile`](deploy/compose/Caddyfile).
- **Authelia, Authentik, Pomerium** and similar forward-auth tools: pass the user's
  email on as `X-Auth-Request-Email`.

Port 8081 is the internal run trigger (`POST /internal/runs` with the bearer token from
`/data/internal-token`). Never expose it.

## Configuration

| Variable | Required | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | yes | | `postgres://...`. Secret. |
| `ALLOWED_EMAILS` | yes | | Comma-separated addresses or `@domain`. |
| `OPENAI_API_KEY` | no | | Secret. Without it, no AI steps. |
| `PUBLIC_URL` | no | | The panel's https URL. Needed for Office 365 / Gmail sign-in. |
| `DRY_RUN` | no | `true` | `false` lets runs move, label and draft. The panel can pause, but not lift an env dry-run. |
| `RUN_INTERVAL_MINUTES` | no | | Server runs itself on this interval (when there is no CronJob). |
| `DATA_DIR` | no | `/data` | Instance keys. Shared by server and worker. |
| `EMBEDDING_CACHE_DIR` | no | `/tmp/models` | Local embedding model cache. Put it on a volume. |
| `TOKEN_ENCRYPTION_KEY`, `INTERNAL_TOKEN` | no | created in `DATA_DIR` | Set both to run without a data volume. Secret. |
| `RSPAMD_URL` | no | | Rspamd HTTP endpoint. |
| `AI_TRIAGE_MODEL`, `AI_DRAFT_MODEL` | no | built-in | OpenAI model ids. |
| `AI_DAILY_BUDGET_USD` | no | `0.5` | Daily AI spend cap. |
| `PORT`, `INTERNAL_PORT` | no | `8080`, `8081` | |

### Adding mailboxes

In the panel, **Set up** tests and saves a mailbox. Passwords and tokens are sealed
with AES-256-GCM before they reach Postgres and are never shown again.

- **IMAP/SMTP:** host, port and an app password. TLS is required.
- **Office 365:** register an app in Microsoft Entra ID with the redirect URI
  `PUBLIC_URL/api/connect/office365/callback` and the delegated permissions
  `IMAP.AccessAsUser.All`, `SMTP.Send` and `offline_access`; paste its client id (and secret).
- **Gmail:** create an OAuth client (Web application) in Google Cloud with the redirect
  URI `PUBLIC_URL/api/connect/gmail/callback` and the `https://mail.google.com/` scope.

## Upgrading

Pull a newer image tag and restart. Migrations run on start, under the same database
lock as runs, so a running worker and a new server never migrate at once.

## More

- [docs/design.md](docs/design.md): architecture and the reasons behind it.
- [docs/ux.md](docs/ux.md): how the panel thinks about email.
- [docs/review.md](docs/review.md): the last security review.
- [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), [LICENSE](LICENSE) (MIT).
