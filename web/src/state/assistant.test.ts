import { beforeAll, describe, expect, it } from "vitest";
import type { AppData } from "../domain/types";
import { mockApi } from "../api/api";
import { answerQuestion, searchByMeaning } from "./assistant";

let data: AppData;

beforeAll(async () => {
  data = await mockApi.loadAppData();
});

describe("answers from what it learned", () => {
  it("knows when the tire change is", () => {
    const answer = answerQuestion(data, "When do I have to change my tires?");
    expect(answer.fact?.id).toBe("f-tires");
    expect(answer.text).toContain("Tue 24 Nov at 13:00");
    expect(answer.matches[0]?.id).toBe(answer.fact?.sourceEmailId);
  });

  it("knows where the birthday party is", () => {
    const answer = answerQuestion(data, "Where is the address of Saga's party?");
    expect(answer.text).toContain("Lekland, Kungsgatan 5");
  });

  it("falls back to emails when no fact fits", () => {
    expect(answerQuestion(data, "Anything about Rust?").fact).toBeUndefined();
  });
});

describe("search by meaning", () => {
  it("finds Java, C# and job mail when asked about programming", () => {
    const subjects = searchByMeaning(data, "programming").map((email) => email.subject);
    expect(subjects).toEqual(expect.arrayContaining([
      "34 new jobs for you: Java, C#, Kotlin and more",
      "Next step: take-home case by 1 Dec",
      "Meetup 27 Nov: coroutines in practice",
    ]));
    expect(subjects).not.toContain("Reminder: appointment Tue 25 Nov 09:30");
  });
});

describe("actions", () => {
  it("offers to unsubscribe from marketing senders", () => {
    expect(answerQuestion(data, "unsubscribe from marketing").proposal?.action).toEqual({ type: "digest/unsubscribeCategory", category: "marketing" });
  });
});
