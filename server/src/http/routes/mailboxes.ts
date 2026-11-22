import { Hono, type Context } from "hono";
import { MailboxInput } from "../../mailboxes/input";
import type { MailboxAdmin, SaveResult } from "../../mailboxes/service";
import { badRequest, done, Id, notFound, parseBody } from "./validate";

/** Add, edit and remove mailboxes. Secrets go in and never come back out. */
export function mailboxRoutes(admin: MailboxAdmin): Hono {
  const app = new Hono();

  app.get("/api/setup/mailboxes", async (c) => c.json(await admin.list()));

  app.post("/api/setup/mailboxes", async (c) => {
    const input = await parseBody(c, MailboxInput);
    return input ? reply(c, await admin.create(input), 201) : badRequest(c);
  });

  app.put("/api/setup/mailboxes/:id", async (c) => {
    const input = await parseBody(c, MailboxInput);
    return input ? reply(c, await admin.update(Id(c), input), 200) : badRequest(c);
  });

  app.delete("/api/setup/mailboxes/:id", async (c) => ((await admin.remove(Id(c))) ? done(c) : notFound(c)));

  return app;
}

function reply(c: Context, result: SaveResult, status: 200 | 201) {
  if (result.ok) return c.json(result.mailbox, status);
  if (result.error === "not_found") return notFound(c);
  return c.json({ error: result.error }, 422);
}
