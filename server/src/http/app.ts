import { Hono } from "hono";
import { requireAllowedUser, type AuthEnv } from "./auth";
import { onError, requestId, type RequestIdEnv } from "./errors";
import { createStore, type Db } from "../store";
import type { AskDeps } from "../life/answerQuestion";
import { apiRoutes } from "./routes/api";
import { connectRoutes, type ConnectDeps } from "./routes/connect";
import { healthRoutes } from "./routes/health";
import { runsRoutes, type RunHistory } from "./routes/runs";
import { setupRoutes, type SetupDeps } from "./routes/setup";
import { serveSpa } from "./static";

export interface AppDeps {
  allowedEmails: readonly string[];
  runs: RunHistory;
  /** Only for OAuth providers; IMAP needs no connect flow. */
  connect?: ConnectDeps;
  /** Test connection and read-only learning from the Set up page. */
  setup?: SetupDeps;
  staticDir: string;
  /** Without these only runs and connect are served. */
  api?: { db: Db; ask: AskDeps };
}

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
  app.route("/", runsRoutes(deps.runs));
  if (deps.api) app.route("/api", apiRoutes(createStore(deps.api.db), deps.api.db, deps.api.ask));
  if (deps.connect) app.route("/", connectRoutes(deps.connect));
  if (deps.setup) app.route("/", setupRoutes(deps.setup));
  app.all("/api/*", (c) => c.json({ error: "not_found" }, 404));
  app.use("*", serveSpa(deps.staticDir));
  return app;
}
