import { describe, expect, it } from "vitest";
import { rspamdCheck } from "../src/spam/rspamdCheck";

const raw = new Uint8Array([1, 2]);
const reply = (body: unknown, status = 200) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("rspamdCheck", () => {
  it("flags spam by score", async () => {
    const v = await rspamdCheck("http://r", reply({ score: 12.4, required_score: 6, action: "add header", symbols: { BAYES_SPAM: {} } })).check(raw);
    expect(v).toEqual({ score: 12.4, isSpam: true, symbols: ["BAYES_SPAM"] });
  });
  it("flags reject and passes ham", async () => {
    expect((await rspamdCheck("http://r", reply({ score: 1, required_score: 6, action: "reject" })).check(raw))?.isSpam).toBe(true);
    expect((await rspamdCheck("http://r", reply({ score: 1, required_score: 6, action: "no action" })).check(raw))?.isSpam).toBe(false);
  });
  it("posts to /checkv2", async () => {
    let url = "";
    const f = (async (u: string) => ((url = u), new Response(JSON.stringify({ score: 0, required_score: 6, action: "no action" })))) as unknown as typeof fetch;
    await rspamdCheck("http://r/", f).check(raw);
    expect(url).toBe("http://r/checkv2");
  });
  it("is undefined on HTTP, parse and network errors", async () => {
    expect(await rspamdCheck("http://r", reply({}, 500)).check(raw)).toBeUndefined();
    expect(await rspamdCheck("http://r", reply({ nope: 1 })).check(raw)).toBeUndefined();
    const down = (async () => { throw new Error("down"); }) as unknown as typeof fetch;
    expect(await rspamdCheck("http://r", down).check(raw)).toBeUndefined();
  });
});
