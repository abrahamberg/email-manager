import type { MailAuth } from "../../ports.js";

export function passwordAuth(user: string, password: string): MailAuth {
  return { credentials: async () => ({ kind: "password", user, password }) };
}
