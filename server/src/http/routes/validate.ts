import type { Context } from "hono";
import type { z } from "zod";

/** Undefined when the body is not JSON or does not match the schema. */
export async function parseBody<T>(c: Context, schema: z.ZodType<T>): Promise<T | undefined> {
  const raw = await c.req.raw.json().catch(() => undefined);
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

export const badRequest = (c: Context) => c.json({ error: "bad_request" }, 400);
export const notFound = (c: Context) => c.json({ error: "not_found" }, 404);
export const done = (c: Context) => c.body(null, 204);
export const Id = (c: Context) => c.req.param("id") ?? "";
