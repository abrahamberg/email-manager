import type { AppData } from "../domain/types";
import type { Answer } from "../state/assistant";
import type { EmailManagerApi } from "./api";
import { routeFor } from "./actionRoutes";
import { createSetupApi } from "./setupApi";

type Fetch = typeof fetch;

export function createHttpApi(fetchFn: Fetch = (...args) => fetch(...args)): EmailManagerApi {
  async function call(method: string, path: string, body?: unknown): Promise<Response> {
    const res = await fetchFn(path, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${method} ${path} failed with status ${res.status}`);
    return res;
  }

  return {
    setup: createSetupApi(fetchFn),
    async loadAppData() {
      return (await (await call("GET", "/api/today")).json()) as AppData;
    },
    async send(action) {
      const { method, path, body } = routeFor(action);
      await call(method, path, body);
    },
    async emailText(id) {
      const res = await fetchFn("/api/emails/body", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      return res.ok ? ((await res.json()) as { text: string }).text : undefined;
    },
    async ask(query) {
      return (await (await call("POST", "/api/ask", { query })).json()) as Answer;
    },
  };
}

export const httpApi = createHttpApi();
