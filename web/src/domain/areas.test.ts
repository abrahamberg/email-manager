import { beforeAll, describe, expect, it } from "vitest";
import type { AppData } from "./types";
import { mockApi } from "../api/api";
import { areaActivity, describeHandled, upcoming } from "./areas";

let data: AppData;

beforeAll(async () => {
  data = await mockApi.loadAppData();
});

describe("areaActivity", () => {
  it("counts what was handled and what still needs you, per area", () => {
    const school = areaActivity(data, "school");
    expect(school.handled.replied).toBe(4);
    expect(school.needYou).toBe(2);
    expect(describeHandled(school)).toBe("I answered 4");
  });
});

describe("upcoming", () => {
  it("lists dated facts in the window, soonest first", () => {
    const titles = upcoming(data.facts, "2026-11-21T00:00:00Z", 7).map((fact) => fact.title);
    expect(titles[0]).toBe("Winter tire change");
    expect(titles).not.toContain("Atlas cutover");
  });
});

