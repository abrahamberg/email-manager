import type { Briefing, MailboxProfile, Run, Settings } from "../../domain/types";

export const briefing: Briefing = {
  since: "2026-11-21T08:00:00Z",
  arrived: 52,
  nextBriefing: "17:00",
};

export const runs: Run[] = [
  { id: "run-6", startedAt: "2026-11-21T12:45:00Z", durationSec: 6, fetched: 3, handledByLogic: 3, sentToAi: 0, tokens: 0, costUsd: 0 },
  { id: "run-5", startedAt: "2026-11-21T12:30:00Z", durationSec: 14, fetched: 7, handledByLogic: 5, sentToAi: 2, tokens: 3100, costUsd: 0.0006 },
  { id: "run-4", startedAt: "2026-11-21T12:15:00Z", durationSec: 3, fetched: 0, handledByLogic: 0, sentToAi: 0, tokens: 0, costUsd: 0, error: "IMAP timeout, retried on the next run" },
  { id: "run-3", startedAt: "2026-11-21T12:00:00Z", durationSec: 22, fetched: 11, handledByLogic: 8, sentToAi: 3, tokens: 6800, costUsd: 0.0081 },
  { id: "run-2", startedAt: "2026-11-21T11:45:00Z", durationSec: 9, fetched: 4, handledByLogic: 4, sentToAi: 0, tokens: 0, costUsd: 0 },
  { id: "run-1", startedAt: "2026-11-21T11:30:00Z", durationSec: 31, fetched: 27, handledByLogic: 21, sentToAi: 6, tokens: 11200, costUsd: 0.0094 },
];

export const settings: Settings = {
  dryRun: false,
  replies: {
    signature: "Best,\nDaniel",
    knownContactsOnly: true,
    topics: ["acknowledge", "confirmAppointment"],
    neverAutoReplyTo: ["contoso.com", "*.gov"],
  },
  mailbox: { host: "imap.example.com", user: "daniel@example.com", connected: true },
  dailySendCap: 10,
  quietHours: { from: "19:00", to: "07:30" },
  briefingTimes: ["08:00", "13:00", "17:00"],
  aiDailyBudgetUsd: 0.5,
  scheduleMinutes: 15,
};

export const profile: MailboxProfile = {
  daysRead: 30,
  emailsRead: 1240,
  peopleYouReplyTo: 86,
  newsletters: 41,
  toneSummary: "Short and friendly. You open with “Hi <name>,”, rarely use exclamation marks, and sign off with “Best, Daniel”.",
  wouldHaveDone: [
    { outcome: "junk", count: 212 },
    { outcome: "digest", count: 604 },
    { outcome: "labeled", count: 188 },
    { outcome: "replied", count: 31 },
    { outcome: "task", count: 24 },
  ],
};
