import { randomUUID } from "node:crypto";
import type { Context, ErrorHandler, MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";

export type RequestIdEnv = { Variables: { requestId: string } };

export const requestId: MiddlewareHandler<RequestIdEnv> = async (c, next) => {
  c.set("requestId", randomUUID());
  await next();
};

/** Logs only a request id and the error's name: messages can carry secrets or mail content. */
export const onError: ErrorHandler = (err, c: Context) => {
  const id = (c.get("requestId") as string | undefined) ?? "-";
  if (err instanceof HTTPException && err.status < 500) {
    return c.json({ error: "bad_request" }, err.status);
  }
  console.error(`http: request ${id} failed: ${err.name}`);
  return c.json({ error: "internal" }, 500);
};
