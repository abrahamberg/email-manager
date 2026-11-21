import { describe, expect, it } from "vitest";
import { aiModels } from "../../src/ai/models";

describe("aiModels", () => {
  it("lets env override each role", () => {
    const defaults = aiModels({});
    const overridden = aiModels({ AI_TRIAGE_MODEL: "custom-triage" });
    expect(overridden.triage).toBe("custom-triage");
    expect(overridden.draft).toBe(defaults.draft);
  });
});
