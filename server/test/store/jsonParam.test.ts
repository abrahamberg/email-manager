import { describe, expect, it } from "vitest";
import { jsonParam } from "../../src/store/db";

describe("jsonParam", () => {
  it.each([
    ['["a","b"]', '["a","b"]'],
    ['{"k":1}', '{"k":1}'],
    [["a"], '["a"]'],
    [{ k: 1 }, '{"k":1}'],
  ])("%j becomes %s without double encoding", (input, expected) => {
    expect(jsonParam(input)).toBe(expected);
  });
});
