import type { EmailRef } from "../../domain/types";

function email(
  id: string,
  name: string,
  address: string,
  subject: string,
  receivedAt: string,
  snippet: string,
  category: EmailRef["category"],
): EmailRef {
  return { id, from: { name, address }, subject, receivedAt, snippet, category };
}

export const emails = {
  anna: email(
    "m1", "Anna Lind", "anna@northwind.io", "Can you share the Q4 numbers before Monday?",
    "2026-11-21T09:12:00Z",
    "Hi! The board pack goes out Monday morning. Could you send me the Q4 revenue table when you have a minute?",
    "question",
  ),
  meetingInvite: email(
    "m2", "Jonas Berg", "jonas@fabrikam.com", "Intro call next week?",
    "2026-11-21T10:40:00Z",
    "Great meeting you at the conference. Would Tuesday or Wednesday morning work for a 30 minute intro call?",
    "meeting",
  ),
  contract: email(
    "m3", "Legal at Contoso", "legal@contoso.com", "Contract renewal: signature needed by 28 Nov",
    "2026-11-21T08:05:00Z",
    "Please review the attached renewal. Pricing changed in section 4. Signature is needed by 28 November.",
    "question",
  ),
  markThread: email(
    "m4", "Mark Jensen", "mark@tailspin.dev", "Re: API access for the pilot",
    "2026-11-16T14:20:00Z",
    "You: Hi Mark, just checking whether the API keys for the pilot are ready?",
    "question",
  ),
  substack: email(
    "m5", "The Weekly Byte", "byte@substack.com", "Issue #212: Rust in the kernel",
    "2026-11-21T07:00:00Z", "This week: Rust in the kernel, a new JS runtime, and five links.", "newsletter",
  ),
  receipt: email(
    "m6", "Northwind Air", "noreply@northwindair.com", "Your receipt for booking KX4F2",
    "2026-11-21T06:30:00Z", "Thank you for flying with us. Total charged: €212.40.", "receipt",
  ),
  phish: email(
    "m7", "Account Security", "security@paypa1-verify.top", "Your account is limited",
    "2026-11-21T05:51:00Z", "Unusual activity detected. Verify your identity within 24 hours.", "security",
  ),
  github: email(
    "m8", "GitHub", "notifications@github.com", "[email-manager] New comment on #3",
    "2026-11-21T11:02:00Z", "abrahamberg commented: looks good to me.", "notification",
  ),
  sale: email(
    "m9", "Outdoor Gear Co", "deals@outdoorgear.example", "48h Black Friday: 40% off everything",
    "2026-11-21T09:00:00Z", "Our biggest sale of the year starts now.", "marketing",
  ),
  dentist: email(
    "m10", "City Dental", "booking@citydental.example", "Reminder: appointment Tue 25 Nov 09:30",
    "2026-11-21T08:40:00Z", "Reply YES to confirm your appointment.", "notification",
  ),
  bankStatement: email(
    "m11", "Contoso Bank", "statements@contosobank.example", "Your November statement is ready",
    "2026-11-21T04:10:00Z", "Your statement for November is available in online banking.", "receipt",
  ),
  recruiter: email(
    "m12", "Priya Shah", "priya@talentlink.example", "Exciting Staff Engineer role",
    "2026-11-21T10:15:00Z", "I came across your profile and think you'd be a great fit for…", "marketing",
  ),
  lisa: email(
    "m13", "Lisa Park", "lisa@northwind.io", "Thanks for the demo!",
    "2026-11-21T09:55:00Z", "Thanks for the demo yesterday, the team loved it. Talk soon!", "question",
  ),
  ci: email(
    "m14", "Buildkite", "builds@buildkite.example", "Build #881 passed",
    "2026-11-21T11:30:00Z", "main: build passed in 4m 12s.", "notification",
  ),
} satisfies Record<string, EmailRef>;
