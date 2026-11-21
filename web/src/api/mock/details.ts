import type { AuthResults, EmailDetail, TraceStep } from "../../domain/types";
import { emails } from "./emails";

const PASS: AuthResults = { spf: "pass", dkim: "pass", dmarc: "pass" };

const rulesPassed: TraceStep = { stage: "rules", result: "passed", note: "No rule matched" };
const spamPassed = (score: number): TraceStep => ({ stage: "spam", result: "passed", note: `Spam score ${score} (limit 6)` });
const notBulk: TraceStep = { stage: "lowValue", result: "passed", note: "Personal mail: no list headers, not a duplicate" };
const skipped = (stage: TraceStep["stage"]): TraceStep => ({ stage, result: "skipped", note: "Not needed, already decided" });

function needsYou(score: number, note: string, tokens: number): TraceStep[] {
  return [rulesPassed, spamPassed(score), notBulk, { stage: "ai", result: "decided", note, tokens }];
}

function detail(body: string, trace: TraceStep[], extra: Partial<EmailDetail> = {}): EmailDetail {
  return { body, to: "daniel@example.com", auth: PASS, spamScore: 0.4, bulkHeaders: [], trace, ...extra };
}

export const details: Record<string, EmailDetail> = {
  [emails.anna.id]: detail(
    "Hi Daniel,\n\nThe board pack goes out Monday morning. Could you send me the Q4 revenue table when you have a minute? The same format as Q3 is perfect.\n\nThanks!\nAnna",
    needsYou(0.2, "Direct question from a frequent contact, deadline Monday. Drafted a reply in your usual tone.", 1420),
  ),
  [emails.meetingInvite.id]: detail(
    "Hi Daniel,\n\nGreat meeting you at the conference. Would Tuesday or Wednesday morning work for a 30 minute intro call? Happy to send an invite.\n\nBest,\nJonas",
    needsYou(0.9, "Meeting request from a new contact. Checked your calendar for free slots.", 1650),
  ),
  [emails.contract.id]: detail(
    "Dear customer,\n\nPlease review the attached renewal for 2027. Pricing changed in section 4 (+8%). Signature is needed by 28 November to avoid a service gap.\n\nContoso Legal",
    needsYou(0.6, "Legal document with a deadline and a price change. Never answered automatically.", 980),
  ),
  [emails.markThread.id]: detail(
    "Hi Mark,\n\nJust checking whether the API keys for the pilot are ready? We'd like to start on Monday.\n\nThanks,\nDaniel",
    [{ stage: "rules", result: "decided", note: "Follow-up check: you wrote last, no answer in 5 days" }, skipped("spam"), skipped("lowValue"), { stage: "ai", result: "decided", note: "Drafted a short nudge", tokens: 610 }],
  ),
  [emails.recruiter.id]: detail(
    "Hi Daniel,\n\nI came across your profile and think you'd be a great fit for a Staff Engineer role at a fast-growing fintech. Open to a quick chat?\n\nPriya",
    needsYou(2.1, "Unsolicited recruiter mail. You ignored the last 9 like this, so I suggest a rule instead of asking every time.", 890),
  ),
  [emails.substack.id]: detail(
    "This week: Rust drivers land in 6.19, a new JS runtime claims 2x faster cold starts, and five links worth your time.\n\nUnsubscribe · View in browser",
    [{ stage: "rules", result: "decided", note: "Your rule: newsletters from substack.com go to the digest" }, skipped("spam"), skipped("lowValue"), skipped("ai")],
    { bulkHeaders: ["List-Unsubscribe", "List-Id: byte.substack.com"] },
  ),
  [emails.receipt.id]: detail(
    "Thank you for flying with us.\n\nBooking KX4F2 · Stockholm → Berlin · 2 Dec\nTotal charged: €212.40",
    [rulesPassed, spamPassed(0.1), { stage: "lowValue", result: "decided", note: "Receipt from a no-reply sender: labelled Receipts, archived" }, skipped("ai")],
  ),
  [emails.phish.id]: detail(
    "Unusual activity detected on your account. Verify your identity within 24 hours or your account will be limited.\n\n[Verify now]",
    [rulesPassed, { stage: "spam", result: "decided", note: "Score 14.2: DMARC fail, look-alike domain paypa1-verify.top, URL listed by URLhaus" }, skipped("lowValue"), skipped("ai")],
    { auth: { spf: "fail", dkim: "none", dmarc: "fail" }, spamScore: 14.2 },
  ),
  [emails.github.id]: detail(
    "abrahamberg commented on #3:\n\n> looks good to me\n\nReply to this email directly or view it on GitHub.",
    [rulesPassed, spamPassed(0.3), { stage: "lowValue", result: "decided", note: "Notification (List-Id) with no question for you" }, skipped("ai")],
    { bulkHeaders: ["List-Id: email-manager.abrahamberg.github.com", "List-Unsubscribe"] },
  ),
  [emails.sale.id]: detail(
    "Our biggest sale of the year starts now: 40% off everything until Sunday at midnight.",
    [rulesPassed, spamPassed(3.8), { stage: "lowValue", result: "decided", note: "Marketing: Precedence bulk and List-Unsubscribe" }, skipped("ai")],
    { bulkHeaders: ["Precedence: bulk", "List-Unsubscribe"], spamScore: 3.8 },
  ),
  [emails.dentist.id]: detail(
    "Reminder: you have an appointment on Tuesday 25 November at 09:30.\n\nReply YES to confirm or call us to reschedule.",
    [rulesPassed, spamPassed(0.5), { stage: "lowValue", result: "passed", note: "Asks for a reply, so not low value" }, { stage: "ai", result: "decided", note: "Appointment matches your calendar. Replied YES (topic allowed: confirm appointments)", tokens: 720 }],
  ),
  [emails.bankStatement.id]: detail(
    "Your statement for November is available in online banking.",
    [{ stage: "rules", result: "decided", note: "Your rule: bank statements are labelled Finance and archived" }, skipped("spam"), skipped("lowValue"), skipped("ai")],
  ),
  [emails.lisa.id]: detail(
    "Thanks for the demo yesterday, the team loved it. Talk soon!\n\nLisa",
    [rulesPassed, spamPassed(0.2), notBulk, { stage: "ai", result: "decided", note: "A thank-you note with no question. Moved to the digest (64% sure, so I'll ask you)", tokens: 540 }],
  ),
  [emails.ci.id]: detail(
    "main: build #881 passed in 4m 12s.",
    [{ stage: "rules", result: "decided", note: "Rule learned by AI: passing builds are archived" }, skipped("spam"), skipped("lowValue"), skipped("ai")],
    { bulkHeaders: ["Auto-Submitted: auto-generated"] },
  ),
};
