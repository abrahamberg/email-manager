import { describe, expect, it } from "vitest";
import { expandQuery, rankByMeaning, similarity } from "./semantic";

describe("expandQuery", () => {
  it("adds related words from the same concept", () => {
    expect(expandQuery("programming").related).toContain("java");
  });

  it("ignores filler words", () => {
    expect([...expandQuery("what is the programming").direct]).toEqual(["programming"]);
  });
});

describe("similarity", () => {
  it("scores a direct word above a related one", () => {
    const query = expandQuery("tires");
    expect(similarity(query, "new tires")).toBeGreaterThan(similarity(query, "car service"));
  });
});

describe("rankByMeaning", () => {
  it("puts the closest item first and drops unrelated ones", () => {
    const ranked = rankByMeaning("programming jobs", ["Kotlin developer role", "Dentist reminder", "Java"], (text) => text);
    expect(ranked).toEqual(["Kotlin developer role", "Java"]);
  });
});
