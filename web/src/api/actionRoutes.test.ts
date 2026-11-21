import { describe, expect, it } from "vitest";
import { actionRoutes, routeFor } from "./actionRoutes";
import { createHttpApi } from "./httpApi";
import type { Action } from "../state/actions";

describe("actionRoutes", () => {
  it("has an entry for every action type", () => {
    const types: Record<Action["type"], true> = Object.fromEntries(Object.keys(actionRoutes).map((k) => [k, true])) as never;
    expect(Object.keys(types)).toHaveLength(19);
  });

  it("builds paths and bodies from the action", () => {
    expect(routeFor({ type: "decision/accept", id: "d 1", edit: { text: "hi" } })).toEqual({ method: "POST", path: "/api/decisions/d%201/accept", body: { text: "hi" } });
    expect(routeFor({ type: "decision/restoreSnoozed" }).path).toBe("/api/decisions/restore");
    expect(routeFor({ type: "settings/update", patch: {} }).method).toBe("PATCH");
    expect(routeFor({ type: "fact/forget", id: "f1" })).toEqual({ method: "DELETE", path: "/api/facts/f1" });
    expect(routeFor({ type: "pick/feedback", streamId: "s", itemId: "i", feedback: "more" }).path).toBe("/api/picks/i/feedback");
  });
});

describe("httpApi", () => {
  function fakeFetch(status: number) {
    const calls: { url: string; init: RequestInit }[] = [];
    const fn = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ text: "ok", matches: [] }), { status });
    }) as unknown as typeof fetch;
    return { fn, calls };
  }

  it("sends an action to its endpoint", async () => {
    const { fn, calls } = fakeFetch(200);
    await createHttpApi(fn).send({ type: "task/toggle", id: "t1" });
    expect(calls[0]?.url).toBe("/api/tasks/t1/toggle");
    expect(calls[0]?.init.method).toBe("POST");
    expect(calls[0]?.init.credentials).toBe("same-origin");
  });

  it("throws with the status on non-2xx", async () => {
    const { fn } = fakeFetch(500);
    await expect(createHttpApi(fn).send({ type: "task/toggle", id: "t1" })).rejects.toThrow("500");
  });

  it("asks and loads", async () => {
    const { fn, calls } = fakeFetch(200);
    const api = createHttpApi(fn);
    expect((await api.ask("when?")).text).toBe("ok");
    expect(calls[0]?.init.body).toBe(JSON.stringify({ query: "when?" }));
    await api.loadAppData();
    expect(calls[1]?.url).toBe("/api/today");
  });
});
