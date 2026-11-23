import type { DigestGroup, Task } from "../../domain/types";
import { emails } from "./emails";
import { lifeEmails as life } from "./lifeEmails";

export const digest: DigestGroup[] = [
  {
    id: "g5", sender: life.jobAlert.from, category: "newsletter", state: "normal",
    entries: [{ subject: life.jobAlert.subject, summary: "Senior Java (remote EU), C# Backend (Stockholm), Staff Kotlin (hybrid). All match your search." }],
  },
  {
    id: "g6", sender: life.cutover.from, category: "notification", state: "normal",
    entries: [{ subject: life.cutover.subject, summary: "Atlas cutover moved to Mon 7 Dec for one more migration dry run." }],
  },
  {
    id: "g7", sender: life.meetup.from, category: "newsletter", state: "normal",
    entries: [{ subject: life.meetup.subject, summary: "27 Nov: Kotlin coroutines talk and a panel on hiring backend developers." }],
  },
  {
    id: "g1", sender: emails.substack.from, category: "newsletter", state: "normal",
    entries: [
      { subject: "Issue #212: Rust in the kernel", summary: "Rust drivers merged for 6.19; a new JS runtime benchmarks 2x faster on cold start." },
    ],
  },
  {
    id: "g2", sender: emails.github.from, category: "notification", state: "normal",
    entries: [
      { subject: "[email-manager] New comment on #3", summary: "sam-dev approved the design doc." },
      { subject: "[email-manager] Branch pushed", summary: "A new branch with the UX mock was pushed." },
    ],
  },
  {
    id: "g3", sender: emails.sale.from, category: "marketing", state: "normal",
    entries: [{ subject: "48h Black Friday: 40% off everything", summary: "40% off all items until Sunday night." }],
  },
  {
    id: "g4", sender: emails.lisa.from, category: "question", state: "normal",
    entries: [{ subject: "Thanks for the demo!", summary: "Lisa says the team loved the demo. No action asked." }],
  },
];

export const tasks: Task[] = [
  { id: "t1", title: "Send Jonas a reply about pricing tiers", owner: "me", email: emails.meetingInvite, due: "2026-11-24", done: false },
  { id: "t2", title: "Approve November expense report", owner: "me", email: emails.bankStatement, due: "2026-11-30", done: false },
  { id: "t3", title: "Mark: API keys for the pilot", owner: "them", email: emails.markThread, done: false },
  { id: "t4", title: "Book flights for the December offsite", owner: "me", email: emails.receipt, done: true },
];
