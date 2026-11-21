import type { Decision, QuickCheck } from "../../domain/types";
import { emails } from "./emails";
import { lifeEmails } from "./lifeEmails";

const unordered: Decision[] = [
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
    why: "Part of your job search: Fabrikam's hiring manager wants an intro call. Both slots are free in your calendar.",
    question: "Which time should I offer Jonas?",
    recommended: 0,
    options: [
      { label: "Thu 26 Nov, 13:00", detail: "Your afternoon is free and you'll have done the Nordpay case prep" },
      { label: "Wed 25 Nov, 11:00", detail: "Possible, but you're at the dentist until about 10:15" },
      { label: "Not interested", detail: "Sends a short, friendly no" },
    ],
  },
  {
    kind: "choice",
    id: "d6",
    email: lifeEmails.classTrip,
    why: "Elsa's class trip needs a signature and a payment. I never sign or pay on my own. Due Friday 27 Nov.",
    question: "What should I do about the Skansen trip?",
    recommended: 0,
    options: [
      { label: "Yes: reply that you'll sign and pay", detail: "I reply to Maria, add “Swish 150 kr” to your tasks and remind you Thursday" },
      { label: "Ask Maria a question first", detail: "I draft a question for you to edit" },
      { label: "Elsa won't go", detail: "I draft a polite reply to Maria" },
    ],
  },
  {
    kind: "reply",
    id: "d7",
    email: lifeEmails.party,
    why: "Elsa is invited to Saga's party on Saturday 28 Nov. Your calendar is free. RSVP is due Wednesday.",
    confidence: 0.8,
    draft: "Hi Lina,\n\nThanks! Elsa would love to come on Saturday. I'll drop her off at Lekland at 14:00.\n\nBest,\nDaniel",
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

const ORDER = ["d1", "d6", "d2", "d7", "d3", "d4", "d5"];

export const decisions = ORDER.map((id) => unordered.find((decision) => decision.id === id)!);

export const quickChecks: QuickCheck[] = [
  { id: "q1", receiptId: "h5", question: "I confirmed your dentist appointment. Was that right?" },
  { id: "q2", receiptId: "h7", question: "I moved Lisa's thank-you note to the digest. Was that right?" },
];
