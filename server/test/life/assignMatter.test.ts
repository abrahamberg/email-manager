import { describe, expect, it } from "vitest";
import { assignMatter, type AssignInput, type MatterCandidate } from "../../src/life/assignMatter";
import { entityKeys } from "../../src/life/entityKeys";
import type { Embedder } from "../../src/ports";

const VOCAB = ["acme", "offer", "interview", "dentist", "appointment", "marathon", "invoice"];
const fakeEmbedder: Embedder = {
  async embed(texts) {
    return texts.map((t) => VOCAB.map((w) => (t.toLowerCase().includes(w) ? 1 : 0)));
  },
};

const acmeJob: MatterCandidate = {
  id: "m1", title: "Acme job offer", areaId: "work", threadIds: ["t1"],
  keys: ["addr:hr@acme.com", "domain:acme.com", "title:acme job offer"], vector: [1, 1, 0, 0, 0, 0, 0],
};
const dentist: MatterCandidate = {
  id: "m2", title: "Dentist appointment", areaId: "health", threadIds: ["t9"],
  keys: ["addr:desk@smiles.example", "domain:smiles.example", "title:dentist appointment"], vector: [0, 0, 0, 1, 1, 0, 0],
};

function input(over: { threadId?: string; from?: string; subject?: string; headers?: Record<string, string> },
  triage: Partial<AssignInput["triage"]> = {}): AssignInput {
  return {
    email: { threadId: over.threadId ?? "tx", from: { address: over.from ?? "someone@gmail.com" },
      headers: over.headers ?? {}, subject: over.subject ?? "" },
    triage: { tier: "worthKnowing", ...triage },
    matters: [dentist, acmeJob],
    embedder: fakeEmbedder,
  };
}

describe("assignMatter", () => {
  it("joins a follow-up in the same thread", async () => {
    expect(await assignMatter(input({ threadId: "t1" }, { tier: "notWorth" }))).toEqual({ matterId: "m1" });
  });

  it("joins a different thread from the same company", async () => {
    const r = await assignMatter(input({ threadId: "t2", from: "recruiter@acme.com", subject: "Next steps" },
      { areaId: "work", matter: "Start date" }));
    expect(r).toEqual({ matterId: "m1" });
  });

  it("joins by the normalized matter title", async () => {
    const r = await assignMatter(input({ subject: "Hi" }, { areaId: "work", matter: "The ACME job-offer" }));
    expect(r).toEqual({ matterId: "m1" });
  });

  it("joins by nearest embedding over the threshold", async () => {
    const r = await assignMatter(input({ subject: "Acme offer letter" }, { areaId: "work" }));
    expect(r).toEqual({ matterId: "m1" });
  });

  it("ignores sender domain for bulk mail", async () => {
    const r = await assignMatter(input({ from: "news@acme.com", subject: "Weekly", headers: { "list-id": "<news.acme.com>" } },
      { areaId: "work", tier: "notWorth" }));
    expect(r).toEqual({});
  });

  it("keeps an unrelated email in the same area separate", async () => {
    const r = await assignMatter(input({ subject: "Your invoice" }, { areaId: "work", matter: "Laptop invoice" }));
    expect(r.matterId).toBeUndefined();
    expect(r.create).toMatchObject({ title: "Laptop invoice", areaId: "work" });
  });

  it("keeps the same title in a different area separate", async () => {
    const r = await assignMatter(input({ subject: "Acme job offer" }, { areaId: "health", matter: "Acme job offer" }));
    expect(r.matterId).toBeUndefined();
    expect(r.create).toMatchObject({ title: "Acme job offer", areaId: "health" });
  });

  it("creates nothing for notWorth mail outside a known thread", async () => {
    expect(await assignMatter(input({ subject: "Sale" }, { tier: "notWorth", areaId: "work", matter: "Sale" }))).toEqual({});
  });

  it("is deterministic regardless of candidate order", async () => {
    const twin = { ...acmeJob, id: "m0", threadIds: [] };
    const a = input({ from: "hr@acme.com" }, { areaId: "work" });
    const b = { ...a, matters: [...a.matters, twin].reverse() };
    expect(await assignMatter({ ...a, matters: [acmeJob, twin] })).toEqual(await assignMatter(b));
  });
});

describe("entityKeys", () => {
  it("skips free-mail domains", () => {
    expect(entityKeys({ from: { address: "Ann@Gmail.com" }, headers: {} }, {})).toEqual(["addr:ann@gmail.com"]);
  });
});
