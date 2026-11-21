import type { EmailDetail, TraceStep } from "../../domain/types";
import { lifeEmails as e } from "./lifeEmails";

const rulesPassed: TraceStep = { stage: "rules", result: "passed", note: "No rule matched" };
const spamOk: TraceStep = { stage: "spam", result: "passed", note: "Spam score 0.3 (limit 6)" };
const skipped = (stage: TraceStep["stage"]): TraceStep => ({ stage, result: "skipped", note: "Not needed, already decided" });

function viaAi(lowValueNote: string, aiNote: string, tokens: number): TraceStep[] {
  return [rulesPassed, spamOk, { stage: "lowValue", result: "passed", note: lowValueNote }, { stage: "ai", result: "decided", note: aiNote, tokens }];
}

function viaHeaders(note: string): TraceStep[] {
  return [rulesPassed, spamOk, { stage: "lowValue", result: "decided", note }, skipped("ai")];
}

function detail(body: string, trace: TraceStep[], bulkHeaders: string[] = []): EmailDetail {
  return { body, to: "daniel@example.com", auth: { spf: "pass", dkim: "pass", dmarc: "pass" }, spamScore: 0.3, bulkHeaders, trace };
}

const LIST = ["List-Id: foraldrar-3b.solberga.example"];

export const lifeDetails: Record<string, EmailDetail> = {
  [e.fair.id]: detail(
    "Hi all!\n\nThe Christmas fair is on Saturday 5 Dec, 10–13. Please reply with what you can bring: baking, coffee, or an hour at a stall.\n\nKarin",
    viaAi("Parents' list, but it asks you something", "Known answer: you brought gingerbread last year and said you'd do it again. Replied for you (topic: facts you've shared).", 980),
    LIST,
  ),
  [e.carpool.id]: detail(
    "Hi Daniel, still OK that you drive Thursday and I take next week? /Peter",
    viaAi("Personal mail", "Matches what you agreed on 14 Nov. Replied “Yes, I'll drive Thursday”.", 640),
  ),
  [e.parentsMeeting.id]: detail(
    "Dear parents,\n\nWe meet on Wednesday 2 Dec at 18:00 in the dining hall at Solberga skola, Skolvägen 3. Please let me know if you can come.\n\nMaria Holm",
    viaAi("Asks for an answer", "Your calendar is free. RSVP'd yes and added it to Coming up (topic: confirm appointments).", 720),
  ),
  [e.allergies.id]: detail(
    "To label the food properly at the fair, please send any allergies in your family. Thanks! Karin",
    viaAi("Parents' list, but it asks you something", "You told me Elsa has a nut allergy. Replied with that (topic: facts you've shared).", 610),
    LIST,
  ),
  [e.classTrip.id]: detail(
    "Dear parents,\n\nOn Thursday 3 Dec class 3B visits Skansen, 08:00–14:00. Please sign the consent form and Swish 150 kr to the class account by Friday 27 Nov. Packed lunch and warm clothes.\n\nMaria Holm",
    viaAi("Asks for an answer", "Needs a signature and a payment, which I never do on my own. Prepared the options.", 830),
  ),
  [e.party.id]: detail(
    "Hi! Saga turns 9 and Elsa is invited to her party on Saturday 28 Nov, 14:00–16:00 at Lekland, Kungsgatan 5. We agreed on 100 kr for gifts. RSVP by Wednesday!\n\nLina",
    viaAi("Personal mail", "An invitation for Elsa. You haven't said whether she's going, so I drafted a yes for you to approve.", 760),
  ),
  [e.tires.id]: detail(
    "Your winter tire change is booked.\n\nTuesday 24 November, 13:00\nDäckcentralen Solna, Industrivägen 12, Solna\nReg. no ABC 123\n\nWelcome!",
    viaHeaders("Booking confirmation from a no-reply sender. Saved the date and address, labelled Car, archived."),
  ),
  [e.cutover.id]: detail(
    "Hi all,\n\nWe need one more week for the data migration dry run. New cutover: Monday 7 Dec, 08:00. Everything else stays the same.\n\nOskar",
    viaAi("Team mail", "An update with no question for you. Updated the Atlas summary and the date, moved to the digest.", 690),
  ),
  [e.jobAlert.id]: detail(
    "34 new jobs match your search. Top picks:\n\n• Staff Backend Engineer, Klarna, Stockholm hybrid (Kotlin, payments)\n• Senior Software Engineer, Platform, Spotify, Remote EU (Java)\n• Senior Frontend Engineer, Volvo Cars, Gothenburg\n• Blockchain Engineer, CoinCo, Remote\n• …and 30 more",
    viaHeaders("Job alert (List-Unsubscribe). Matches your job search, so it's in the digest under Job search."),
    ["List-Unsubscribe", "Precedence: bulk"],
  ),
  [e.nordpay.id]: detail(
    "Hi Daniel,\n\nThanks for the first interview! The next step is a small take-home case in Java or C#. It takes about 3 hours. Please send it by Tuesday 1 Dec.\n\nSara",
    viaAi("Personal mail", "A deadline in your job search. Added it to Coming up and labelled Job search. No reply needed yet.", 700),
  ),
  [e.meetup.id]: detail(
    "Join us on 27 Nov for talks on Kotlin coroutines in practice and a panel on hiring backend developers in 2027.",
    viaHeaders("Event newsletter (List-Id). In the digest."),
    ["List-Id: events.kotlin-sthlm.example"],
  ),
};
