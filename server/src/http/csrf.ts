import type { MiddlewareHandler } from "hono";

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);
const WITH_BODY = new Set(["POST", "PUT", "PATCH"]);

const isJson = (contentType: string | undefined) =>
  (contentType ?? "").split(";")[0]!.trim().toLowerCase() === "application/json";

/**
 * Why: oauth2-proxy authenticates by cookie, so a page on another site could make the
 * browser send a state-changing request. A JSON content type cannot be set cross-site
 * without a CORS preflight (which this server never answers), and Sec-Fetch-Site lets
 * modern browsers tell us outright when a request came from elsewhere.
 */
export const requireSameOrigin: MiddlewareHandler = async (c, next) => {
  const method = c.req.method.toUpperCase();
  if (SAFE.has(method)) return next();
  const site = c.req.header("Sec-Fetch-Site");
  if (site && site !== "same-origin") return c.json({ error: "forbidden" }, 403);
  if (WITH_BODY.has(method) && !isJson(c.req.header("Content-Type"))) return c.json({ error: "unsupported_media_type" }, 415);
  return next();
};
