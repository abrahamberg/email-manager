import type { Decision, QuickCheck } from "../../domain/types";
import { emails } from "./emails";

export const decisions: Decision[] = [
  {
    kind: "reply",
    id: "d1",
    email: emails.anna,
    why: "Anna is a frequent contact and asked a direct question with a deadline.",
    confidence: 0.86,
    draft:
      "Hi Anna,\n\nSure. I'll send the Q4 revenue table by Friday afternoon so you have it well before Monday.\n\nBest,\nDaniel",
  },
  {
    kind: "choice",
    id: "d2",
    email: emails.meetingInvite,
    why: "A new contact asks for a meeting. Both slots are free in your calendar.",
    question: "Which time should I offer Jonas?",
    recommended: 0,
    options: [
      { label: "Tue 25 Nov, 10:00", detail: "Your calendar is free all morning" },
      { label: "Wed 26 Nov, 09:30", detail: "Free, but right before your 10:00 stand-up" },
      { label: "Decline politely", detail: "Sends a short, friendly no" },
    ],
  },
  {
    kind: "task",
    id: "d3",
    email: emails.contract,
    why: "A legal document with a deadline and a price change. I won't act on this myself.",
    title: "Review Contoso renewal (pricing changed in section 4) and sign",
    due: "2026-11-28",
  },
  {
    kind: "followUp",
    id: "d4",
    email: emails.markThread,
    why: "You asked Mark a question 5 days ago and he hasn't answered.",
    waitingDays: 5,
    draft: "Hi Mark,\n\nA quick nudge on the pilot API keys. Any update on timing?\n\nThanks,\nDaniel",
  },
  {
    kind: "ruleProposal",
    id: "d5",
    email: emails.recruiter,
    why: "You ignored the last 9 recruiter emails from this kind of sender.",
    ruleId: "r-ai-1",
  },
];

export const quickChecks: QuickCheck[] = [
  { id: "q1", receiptId: "h5", question: "I confirmed your dentist appointment. Was that right?" },
  { id: "q2", receiptId: "h7", question: "I moved Lisa's thank-you note to the digest. Was that right?" },
];
