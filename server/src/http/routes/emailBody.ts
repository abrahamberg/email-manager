import { Hono } from "hono";
import { z } from "zod";
import { parseEmail } from "../../mail/parseEmail";
import type { ReadOnlyMailbox } from "../../setup/readOnly";
import { badRequest, parseBody } from "./validate";

const Body = z.object({ id: z.string().trim().min(1).max(998) }).strict();

export interface EmailBodyDeps {
  /** The mailbox a stored message was read from; undefined when unknown. */
  mailboxOf(messageId: string): Promise<string | undefined>;
  reader(mailboxId: string): Promise<ReadOnlyMailbox | undefined>;
}

/** Why: bodies are never stored, so opening an email reads it from the mailbox for that one request. */
export function emailBodyRoutes(deps: EmailBodyDeps): Hono {
  const app = new Hono();
  app.post("/api/emails/body", async (c) => {
    const body = await parseBody(c, Body);
    if (!body) return badRequest(c);
    const mailboxId = await deps.mailboxOf(body.id);
    const mailbox = mailboxId ? await deps.reader(mailboxId) : undefined;
    if (!mailbox) return c.json({ error: "not_found" }, 404);
    try {
      const raw = await mailbox.readMessage(body.id);
      if (!raw) return c.json({ error: "not_found" }, 404);
      return c.json({ text: (await parseEmail(0, raw)).text });
    } catch {
      return c.json({ error: "unavailable" }, 502);
    } finally {
      await mailbox.close().catch(() => undefined);
    }
  });
  return app;
}
