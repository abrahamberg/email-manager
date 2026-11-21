import { Hono } from "hono";
import type { OAuthProviderId } from "../../mail/auth/providers";
import { checkConnection } from "../../setup/checkConnection";
import { learnFromMail } from "../../setup/learnFromMail";
import type { ReadOnlyMailbox } from "../../setup/readOnly";
import { SetupTarget } from "../../setup/target";
import { badRequest, parseBody } from "./validate";

export interface SetupDeps {
  /** Undefined when the target cannot be reached with this deployment (OAuth not configured). */
  reader(target: SetupTarget): ReadOnlyMailbox | undefined;
  oauthEnabled: boolean;
  connected(): Promise<Record<OAuthProviderId, boolean>>;
  now(): Date;
}

// Why: the panel has no encrypted store for a mailbox password, so it is used for one call and dropped.
const IMAP_NOTE = "The password was used for this check only and was not saved. Runs use the password in the deployment secret.";

export function setupRoutes(deps: SetupDeps): Hono {
  const app = new Hono();

  app.get("/api/setup/status", async (c) =>
    c.json({ oauthEnabled: deps.oauthEnabled, connected: deps.oauthEnabled ? await deps.connected() : { office365: false, gmail: false } }));

  app.post("/api/setup/test", async (c) => {
    const target = await parseBody(c, SetupTarget);
    if (!target) return badRequest(c);
    const mailbox = deps.reader(target);
    if (!mailbox) return c.json({ error: "not_configured" }, 409);
    return c.json({ ...(await checkConnection(mailbox)), ...note(target) });
  });

  app.post("/api/setup/learn", async (c) => {
    const target = await parseBody(c, SetupTarget);
    if (!target) return badRequest(c);
    const mailbox = deps.reader(target);
    if (!mailbox) return c.json({ error: "not_configured" }, 409);
    return c.json({ ...(await learnFromMail(mailbox, deps.now())), ...note(target) });
  });

  return app;
}

const note = (target: SetupTarget) => (target.provider === "imap" ? { note: IMAP_NOTE } : {});
