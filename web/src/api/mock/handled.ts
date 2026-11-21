import type { Receipt } from "../../domain/types";
import { emails } from "./emails";

export const receipts: Receipt[] = [
  {
    id: "h1", email: emails.phish, outcome: "junk", signal: "spam", confidence: 0.99, at: "2026-11-21T05:52:00Z",
    reason: "Spam score 14.2: DMARC failed, look-alike domain, URL on a phishing blocklist",
  },
  {
    id: "h2", email: emails.substack, outcome: "digest", signal: "rule", confidence: 1, at: "2026-11-21T07:01:00Z",
    reason: "Newsletters from substack.com go to the digest",
  },
  {
    id: "h3", email: emails.receipt, outcome: "labeled", signal: "headers", confidence: 0.97, at: "2026-11-21T06:31:00Z",
    reason: "Receipt from a no-reply sender. Labelled Receipts and archived",
  },
  {
    id: "h4", email: emails.github, outcome: "digest", signal: "headers", confidence: 0.95, at: "2026-11-21T11:03:00Z",
    reason: "Notification with List-Id header and no question for you",
  },
  {
    id: "h5", email: emails.dentist, outcome: "replied", signal: "ai", confidence: 0.78, at: "2026-11-21T08:42:00Z",
    reason: "Appointment confirmation. Matches your calendar, so I replied YES",
  },
  {
    id: "h6", email: emails.sale, outcome: "digest", signal: "headers", confidence: 0.98, at: "2026-11-21T09:01:00Z",
    reason: "Marketing mail (Precedence: bulk, List-Unsubscribe)",
  },
  {
    id: "h7", email: emails.lisa, outcome: "digest", signal: "ai", confidence: 0.64, at: "2026-11-21T09:56:00Z",
    reason: "A thank-you note with no question or request",
  },
  {
    id: "h8", email: emails.bankStatement, outcome: "labeled", signal: "rule", confidence: 1, at: "2026-11-21T04:11:00Z",
    reason: "Bank statements are labelled Finance and archived",
  },
  {
    id: "h9", email: emails.ci, outcome: "archived", signal: "rule", confidence: 1, at: "2026-11-21T11:31:00Z",
    reason: "Passing builds are archived. Failing builds still reach you",
  },
];
