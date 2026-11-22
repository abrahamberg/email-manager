import { Hono } from "hono";
import type { MailboxAdmin } from "../../mailboxes/service";
import { checkConnection } from "../../setup/checkConnection";
import { learnFromMail } from "../../setup/learnFromMail";
import type { ReadOnlyMailbox } from "../../setup/readOnly";
import { SetupTarget } from "../../setup/target";
import { mailboxRoutes } from "./mailboxes";
import { badRequest, parseBody } from "./validate";

export interface SetupDeps {
  /** Undefined when no saved mailbox has that id. */
  reader(target: SetupTarget): Promise<ReadOnlyMailbox | undefined>;
  mailboxes: MailboxAdmin;
  /** Sign-in with Microsoft or Google needs PUBLIC_URL for the redirect. */
  oauthEnabled: boolean;
  now(): Date;
}

const UNSAVED_NOTE = "This check did not save anything. Add the mailbox to keep these settings; the password is stored encrypted.";

export function setupRoutes(deps: SetupDeps): Hono {
  const app = new Hono();
  app.route("/", mailboxRoutes(deps.mailboxes));

  app.get("/api/setup/status", (c) => c.json({ oauthEnabled: deps.oauthEnabled }));

  app.post("/api/setup/test", async (c) => {
    const target = await parseBody(c, SetupTarget);
    if (!target) return badRequest(c);
    const mailbox = await deps.reader(target);
    if (!mailbox) return c.json({ error: "not_found" }, 404);
    return c.json({ ...(await checkConnection(mailbox)), ...note(target) });
  });

  app.post("/api/setup/learn", async (c) => {
    const target = await parseBody(c, SetupTarget);
    if (!target) return badRequest(c);
    const mailbox = await deps.reader(target);
    if (!mailbox) return c.json({ error: "not_found" }, 404);
    return c.json({ ...(await learnFromMail(mailbox, deps.now())), ...note(target) });
  });

  return app;
}

const note = (target: SetupTarget) => ("provider" in target ? { note: UNSAVED_NOTE } : {});
