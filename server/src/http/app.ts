import { Hono } from "hono";
import { requireAllowedUser, type AuthEnv } from "./auth";
import { onError, requestId, type RequestIdEnv } from "./errors";
import { connectRoutes, type ConnectDeps } from "./routes/connect";
import { healthRoutes } from "./routes/health";
import { runsRoutes, type RunHistory } from "./routes/runs";
import { serveSpa } from "./static";

export interface AppDeps {
  allowedEmails: readonly string[];
  runs: RunHistory;
  /** Only for OAuth providers; IMAP needs no connect flow. */
  connect?: ConnectDeps;
  staticDir: string;
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
  if (deps.connect) app.route("/", connectRoutes(deps.connect));
  app.all("/api/*", (c) => c.json({ error: "not_found" }, 404));
  app.use("*", serveSpa(deps.staticDir));
  return app;
}
