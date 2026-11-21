import { describe, expect, it } from "vitest";
import type { CategoryPolicy } from "./types";
import { suggestAutonomy } from "./autonomy";

function policy(overrides: Partial<CategoryPolicy>): CategoryPolicy {
  return { category: "newsletter", label: "Newsletters", level: "suggest", correct: 0, checked: 0, sendsMail: false, ...overrides };
}

describe("suggestAutonomy", () => {
  it("suggests nothing without checks", () => {
    expect(suggestAutonomy(policy({}))).toBeUndefined();
  });

  it("promotes one level after enough accurate checks", () => {
    expect(suggestAutonomy(policy({ correct: 40, checked: 40 }))).toBe("act");
  });

  it("waits for enough checks even when all were right", () => {
    expect(suggestAutonomy(policy({ correct: 5, checked: 5 }))).toBeUndefined();
  });

  it("never suggests sending on its own", () => {
    expect(suggestAutonomy(policy({ sendsMail: true, correct: 100, checked: 100 }))).toBeUndefined();
  });

  it("demotes when accuracy drops", () => {
    expect(suggestAutonomy(policy({ level: "act", correct: 7, checked: 10 }))).toBe("suggest");
  });

  it("does not demote below watch", () => {
    expect(suggestAutonomy(policy({ level: "watch", correct: 1, checked: 10 }))).toBeUndefined();
  });
});
