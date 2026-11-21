import type { Stream } from "../../domain/types";
import { emails } from "./emails";
import { lifeEmails } from "./lifeEmails";

export const streams: Stream[] = [
  {
    id: "st-jobs", name: "LinkedIn job alerts", areaId: "jobs", emailId: lifeEmails.jobAlert.id, period: "this week", total: 34,
    picks: [
      {
        id: "st-jobs-1", title: "Staff Backend Engineer", facts: ["Klarna", "Stockholm, hybrid", "Kotlin, payments"],
        why: "Staff level and Kotlin, close to the Fabrikam role.", closes: "2026-11-27T22:00:00Z",
      },
      {
        id: "st-jobs-2", title: "Senior Software Engineer, Platform", facts: ["Spotify", "Remote (EU)", "Java, distributed systems"],
        why: "Remote backend work in Java.",
      },
    ],
    rest: "mostly frontend, crypto, or onsite in Gothenburg",
  },
  {
    id: "st-byte", name: "The Weekly Byte", areaId: "jobs", emailId: emails.substack.id, period: "this issue", total: 12,
    picks: [
      {
        id: "st-byte-1", title: "Structured concurrency with Kotlin coroutines", facts: ["8 min read"],
        why: "Matches the Kotlin meetup you're going to on 27 Nov.",
      },
    ],
    rest: "AI tools, frontend frameworks and Rust",
  },
];
