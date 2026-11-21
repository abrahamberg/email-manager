import type { CategoryPolicy, Rule, RuleFeed } from "../../domain/types";

export const policies: CategoryPolicy[] = [
  { category: "security", label: "Spam and phishing", level: "quiet", correct: 212, checked: 214, sendsMail: false },
  { category: "newsletter", label: "Newsletters", level: "act", correct: 42, checked: 42, sendsMail: false },
  { category: "marketing", label: "Marketing and offers", level: "act", correct: 37, checked: 38, sendsMail: false },
  { category: "notification", label: "Notifications", level: "suggest", correct: 25, checked: 26, sendsMail: false },
  { category: "receipt", label: "Receipts and statements", level: "act", correct: 30, checked: 30, sendsMail: false },
  { category: "meeting", label: "Meeting requests", level: "suggest", correct: 11, checked: 12, sendsMail: true },
  { category: "question", label: "Questions from contacts", level: "suggest", correct: 7, checked: 10, sendsMail: true },
];

export const rules: Rule[] = [
  { id: "r1", text: "Newsletters from substack.com go to the digest", when: [{ field: "from", operator: "endsWith", value: "@substack.com" }], then: { kind: "digest" }, source: "user", status: "active", hits: 64 },
  { id: "r2", text: "Bank statements are labelled Finance and archived", when: [{ field: "from", operator: "endsWith", value: "contosobank.example" }, { field: "subject", operator: "contains", value: "statement" }], then: { kind: "label", label: "Finance" }, source: "user", status: "active", hits: 11 },
  { id: "r3", text: "Passing CI builds are archived, failing builds stay in the inbox", source: "ai", status: "active", hits: 140 },
  { id: "r4", text: "Mail that fails DMARC from a look-alike domain goes to Junk", source: "feed", status: "active", hits: 23 },
  { id: "r5", text: "Mail linking to a URLhaus-listed domain goes to Junk", source: "feed", status: "active", hits: 4 },
  { id: "r6", text: "Anything from my accountant always reaches me", when: [{ field: "from", operator: "is", value: "eva@ledger.example" }], then: { kind: "alwaysShow" }, source: "user", status: "active", hits: 3 },
  { id: "r-ai-1", text: "Unsolicited recruiter emails go to the digest", source: "ai", status: "proposed", hits: 0 },
  { id: "r-ai-2", text: "Calendar acceptances (\"Accepted: …\") are archived", source: "ai", status: "proposed", hits: 0 },
  { id: "r7", text: "Shipping updates are labelled Orders", source: "user", status: "disabled", hits: 18 },
];

export const feeds: RuleFeed[] = [
  { id: "f1", name: "Rspamd rule maps", host: "maps.rspamd.com", version: "2026-11-21.1", updatedAt: "2026-11-21T03:00:00Z", verified: true, ruleCount: 4120 },
  { id: "f2", name: "Spamhaus DQS (ZEN, DBL)", host: "dq.spamhaus.net", version: "live", updatedAt: "2026-11-21T12:50:00Z", verified: true, ruleCount: 2 },
  { id: "f3", name: "abuse.ch URLhaus domains", host: "urlhaus.abuse.ch", version: "2026-11-21T12:00", updatedAt: "2026-11-21T12:00:00Z", verified: true, ruleCount: 18342 },
  { id: "f4", name: "Community newsletter senders", host: "rules.example.org", version: "1.4.0", updatedAt: "2026-11-20T22:00:00Z", verified: false, ruleCount: 380 },
];
