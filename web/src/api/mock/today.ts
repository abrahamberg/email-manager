import type { Decision, QuickCheck } from "../../domain/types";
import { emails } from "./emails";
import { lifeEmails } from "./lifeEmails";

const unordered: Decision[] = [
  {
    kind: "reply",
    id: "d1",
    matter: "Q4 numbers for Monday's board pack",
    need: "Anna needs the Q4 revenue table before Monday. I drafted a reply promising it by Friday.",
    deadline: "2026-11-23T08:00:00Z",
    email: emails.anna,
    why: "Anna is a frequent contact and asked a direct question with a deadline.",
    confidence: 0.86,
    draft:
      "Hi Anna,\n\nSure. I'll send the Q4 revenue table by Friday afternoon so you have it well before Monday.\n\nBest,\nAlex",
  },
  {
    kind: "choice",
    id: "d2",
    matter: "Fabrikam intro call",
    need: "Jonas, the hiring manager, wants a call next week. Pick a time and I'll answer him.",
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
    matter: "Elsa's trip to Skansen",
    need: "The class needs your consent and 150 kr by Friday.",
    deadline: "2026-11-27T16:00:00Z",
    email: lifeEmails.classTrip,
    why: "It needs a signature and a payment. I never sign or pay on my own.",
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
    matter: "Saga's party on Saturday",
    need: "Elsa is invited and your Saturday is free. I drafted a yes.",
    deadline: "2026-11-25T16:00:00Z",
    email: lifeEmails.party,
    why: "I answer invitations for Elsa only after you've said yes once.",
    confidence: 0.8,
    draft: "Hi Lina,\n\nThanks! Elsa would love to come on Saturday. I'll drop her off at Lekland at 14:00.\n\nBest,\nAlex",
  },
  {
    kind: "task",
    id: "d3",
    matter: "Contoso renewal",
    need: "The contract renews with an 8% price rise unless you act. It needs your signature.",
    deadline: "2026-11-28T16:00:00Z",
    email: emails.contract,
    why: "A legal document with a deadline and a price change. I won't act on this myself.",
    title: "Review Contoso renewal (pricing changed in section 4) and sign",
    due: "2026-11-28",
  },
  {
    kind: "followUp",
    id: "d4",
    matter: "Pilot API keys from Mark",
    need: "The Atlas cutover waits on these. You asked 5 days ago with no answer. I can nudge him.",
    email: emails.markThread,
    why: "You asked Mark a question 5 days ago and he hasn't answered.",
    waitingDays: 5,
    draft: "Hi Mark,\n\nA quick nudge on the pilot API keys. Any update on timing?\n\nThanks,\nAlex",
  },
  {
    kind: "ruleProposal",
    id: "d5",
    matter: "Recruiter mail",
    need: "Stop showing cold recruiter emails?",
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
