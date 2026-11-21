import { Hono } from "hono";
import { z } from "zod";
import { answerQuestion, type AskDeps } from "../../life/answerQuestion";

const body = z.object({ query: z.string().trim().min(1).max(300) });

export function askRoutes(deps: AskDeps): Hono {
  return new Hono().post("/ask", async (c) => {
    const parsed = body.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) return c.json({ error: "bad_request" }, 400);
    return c.json(await answerQuestion(deps, parsed.data.query));
  });
}
