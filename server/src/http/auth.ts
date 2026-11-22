import type { MiddlewareHandler } from "hono";

export type AuthEnv = { Variables: { userEmail: string } };

// oauth2-proxy sets this header; a NetworkPolicy ensures only it can reach the public port.
export const USER_HEADER = "X-Auth-Request-Email";

/** Entries are full addresses, or "@domain" for every address at exactly that domain. */
export function isAllowed(allowed: ReadonlySet<string>, email: string): boolean {
  const parts = email.split("@");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
  return allowed.has(email) || allowed.has(`@${parts[1]}`);
}

export function requireAllowedUser(allowedEmails: readonly string[]): MiddlewareHandler<AuthEnv> {
  const allowed = new Set(allowedEmails.map(normalizeEmail));
  return async (c, next) => {
    const raw = c.req.header(USER_HEADER);
    if (!raw || !raw.trim()) return c.json({ error: "unauthenticated" }, 401);
    const email = normalizeEmail(raw);
    if (!isAllowed(allowed, email)) return c.json({ error: "forbidden" }, 403);
    c.set("userEmail", email);
    await next();
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
