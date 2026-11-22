import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { requireAllowedUser, type AuthEnv } from "./auth";
import { requireSameOrigin } from "./csrf";
import { onError, requestId, type RequestIdEnv } from "./errors";
import { createStore, type Db, type Store } from "../store";
import type { AskDeps } from "../life/answerQuestion";
import { apiRoutes } from "./routes/api";
import { connectRoutes, type ConnectDeps } from "./routes/connect";
import { healthRoutes } from "./routes/health";
import { runsRoutes, type RunHistory } from "./routes/runs";
import { emailBodyRoutes, type EmailBodyDeps } from "./routes/emailBody";
import { setupRoutes, type SetupDeps } from "./routes/setup";
import { serveSpa } from "./static";

export interface AppDeps {
  allowedEmails: readonly string[];
  runs: RunHistory;
  /** OAuth sign-in per mailbox; absent without PUBLIC_URL. */
  connect?: ConnectDeps;
  /** Test connection and read-only learning from the Set up page. */
  setup?: SetupDeps;
  staticDir: string;
  /** Without these only runs and connect are served. */
  api?: { db: Db; ask: AskDeps };
}

const MAX_BODY_BYTES = 64 * 1024;
const CSP = "default-src 'self'; frame-ancestors 'none'";

/** The public listener. Internal routes live in internalApp and are never mounted here. */
export function createApp(deps: AppDeps): Hono<AuthEnv & RequestIdEnv> {
  const app = new Hono<AuthEnv & RequestIdEnv>();
  app.use(requestId);
  app.use(async (c, next) => {
    await next();
    c.header("Content-Security-Policy", CSP);
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Referrer-Policy", "same-origin");
  });
  app.onError(onError);
  app.route("/", healthRoutes());
  app.use("/api/*", requireAllowedUser(deps.allowedEmails));
  app.use("/api/*", requireSameOrigin);
  app.use("/api/*", bodyLimit({ maxSize: MAX_BODY_BYTES, onError: (c) => c.json({ error: "too_large" }, 413) }));
  app.route("/", runsRoutes(deps.runs));
  const store = deps.api && createStore(deps.api.db);
  if (deps.api && store) app.route("/api", apiRoutes(store, deps.api.db, deps.api.ask));
  if (store && deps.setup) app.route("/", emailBodyRoutes(emailBodyDeps(store, deps.setup)));
  if (deps.connect) app.route("/", connectRoutes(deps.connect));
  if (deps.setup) app.route("/", setupRoutes(deps.setup));
  app.all("/api/*", (c) => c.json({ error: "not_found" }, 404));
  app.use("*", serveSpa(deps.staticDir));
  return app;
}

function emailBodyDeps(store: Store, setup: SetupDeps): EmailBodyDeps {
  return {
    mailboxOf: async (id) => (await store.messages.get(id))?.mailboxId,
    reader: (mailboxId) => setup.reader({ mailboxId }),
  };
}
