import { describe, expect, it } from "vitest";
import { splitLinks } from "./links";

describe("splitLinks", () => {
  it.each([
    ["no links", "hello", [{ text: "hello" }]],
    ["one link", "see https://a.com/x?y=1 now", [{ text: "see " }, { text: "https://a.com/x?y=1", href: "https://a.com/x?y=1" }, { text: " now" }]],
    ["trailing punctuation stays outside", "go to http://a.com.", [{ text: "go to " }, { text: "http://a.com", href: "http://a.com/" }, { text: "." }]],
    ["angle brackets", "<https://a.com/p>", [{ text: "<" }, { text: "https://a.com/p", href: "https://a.com/p" }, { text: ">" }]],
    ["two links", "https://a.com https://b.com", [{ text: "https://a.com", href: "https://a.com/" }, { text: " " }, { text: "https://b.com", href: "https://b.com/" }]],
    ["other schemes are not links", "javascript:alert(1) and ftp://a.com", [{ text: "javascript:alert(1) and ftp://a.com" }]],
  ])("%s", (_name, input, expected) => {
    expect(splitLinks(input)).toEqual(expected);
  });

  it("shortens only the shown text of a long link", () => {
    const url = `https://a.com/${"x".repeat(100)}`;
    const [part] = splitLinks(url);
    expect(part?.href).toBe(url);
    expect(part?.text.length).toBe(70);
    expect(part?.text.endsWith("…")).toBe(true);
  });
});
