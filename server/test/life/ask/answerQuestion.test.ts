import { beforeAll, describe, expect, it } from "vitest";
import type { Fact } from "@email-manager/shared";
import type { Embedder } from "../../../src/ports";
import { answerQuestion, type AskDeps } from "../../../src/life/answerQuestion";
import { askRoutes } from "../../../src/http/routes/ask";
import { vectorSearch } from "../../../src/search/vectorSearch";
import { embeddingRepo } from "../../../src/store/embeddings";
import { factRepo } from "../../../src/store/facts";
import { messageRepo } from "../../../src/store/messages";
import { decisionRepo } from "../../../src/store/decisions";
import { areaRepo } from "../../../src/store/areas";
import { useFreshDb } from "../../store/freshDb";

const DIM = 128;
const hash = (w: string) => [...w].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % DIM, 7);
const embedder: Embedder = {
  async embed(texts) {
    return texts.map((t) => {
      const v = new Array<number>(DIM).fill(0);
      for (const w of t.toLowerCase().match(/[a-z]+/g) ?? []) v[hash(w)]! += 1;
      return v;
    });
  },
};

const msgs = [
  ["m-tires", "Garage", "Tire change booked", "Your tire change is booked, bring the tires"],
  ["m-party", "Lekland", "Saga's party invitation", "Birthday party for Saga at Lekland"],
  ["m-job", "Jobs", "34 new jobs for you: programming Java Kotlin", "programming jobs Java Kotlin developer"],
  ["m-dentist", "Clinic", "Reminder: appointment Tue 09:30", "dentist appointment reminder"],
] as const;

describe("answerQuestion", () => {
  const db = useFreshDb();
  let deps: AskDeps;

  beforeAll(async () => {
    const search = vectorSearch(embeddingRepo(db()), embedder);
    const facts = factRepo(db());
    const messages = messageRepo(db());
    let uid = 1;
    for (const [id, from, subject, text] of msgs) {
      await messages.save({ messageId: id, uid: uid++, fromAddress: `${from.toLowerCase()}@x.se`, fromName: from,
        subject, receivedAt: "2026-11-20T10:00:00Z", compactText: text });
      await search.index("message", id, `${subject} ${text}`);
    }
    await areaRepo(db()).save({ id: "a", shortName: "Home", kind: "home", name: "Home", summary: "", people: [] });
    const fs: Fact[] = [
      { id: "f-tires", areaId: "a", kind: "appointment" as const, title: "Change tires", detail: "Winter tires on the car",
        at: "2026-11-24T12:00:00Z", place: "Garage", sourceEmailId: "m-tires" },
      { id: "f-party", areaId: "a", kind: "address" as const, title: "Saga's birthday party", detail: "Bring a gift",
        at: "2026-11-28T10:00:00Z", place: "Lekland, Kungsgatan 5", sourceEmailId: "m-party" },
    ];
    for (const f of fs) {
      await facts.save(f);
      await search.index("fact", f.id, `${f.title} ${f.detail} ${f.place}`);
    }
    deps = { facts, messages, decisions: decisionRepo(db()), search };
  });

  it("knows when the tire change is, source first", async () => {
    const a = await answerQuestion(deps, "When do I have to change my tires?");
    expect(a.fact?.id).toBe("f-tires");
    expect(a.text).toContain("Tue 24 Nov at 13:00");
    expect(a.matches[0]?.id).toBe("m-tires");
  });

  it("knows where the party is", async () => {
    const a = await answerQuestion(deps, "Where is the address of Saga's party?");
    expect(a.text).toContain("Lekland, Kungsgatan 5");
  });

  it("gives no fact for Rust", async () => {
    expect((await answerQuestion(deps, "Anything about Rust?")).fact).toBeUndefined();
  });

  it("finds job mail, not the dentist, for programming", async () => {
    const a = await answerQuestion(deps, "programming");
    expect(a.fact).toBeUndefined();
    const ids = a.matches.map((m) => m.id);
    expect(ids).toContain("m-job");
    expect(ids).not.toContain("m-dentist");
  });

  it("proposes unsubscribe and pause", async () => {
    expect((await answerQuestion(deps, "unsubscribe from marketing")).proposal?.action)
      .toEqual({ type: "digest/unsubscribeCategory", category: "marketing" });
    expect((await answerQuestion(deps, "pause")).proposal?.action).toEqual({ type: "settings/update", patch: { dryRun: true } });
  });

  it("answers needs-me from pending decisions", async () => {
    expect((await answerQuestion(deps, "what needs me?")).text).toBe("Nothing needs you right now.");
  });

  it("validates the request body", async () => {
    const app = askRoutes(deps);
    const post = (body: unknown) => app.request("/ask", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
    expect((await post({ query: "x".repeat(301) })).status).toBe(400);
    expect((await post({})).status).toBe(400);
    expect((await post({ query: "unsubscribe" })).status).toBe(200);
  });
});
