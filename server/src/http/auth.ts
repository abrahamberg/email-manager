import type { MiddlewareHandler } from "hono";

export type AuthEnv = { Variables: { userEmail: string } };

// oauth2-proxy sets this header; a NetworkPolicy ensures only it can reach the public port.
export const USER_HEADER = "X-Auth-Request-Email";

export function requireAllowedUser(allowedEmails: readonly string[]): MiddlewareHandler<AuthEnv> {
  const allowed = new Set(allowedEmails.map(normalizeEmail));
  return async (c, next) => {
    const raw = c.req.header(USER_HEADER);
    if (!raw || !raw.trim()) return c.json({ error: "unauthenticated" }, 401);
    const email = normalizeEmail(raw);
    if (!allowed.has(email)) return c.json({ error: "forbidden" }, 403);
    c.set("userEmail", email);
    await next();
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
