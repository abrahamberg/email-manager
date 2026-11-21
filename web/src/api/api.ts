import type { AppData } from "../domain/types";
import type { Action } from "../state/actions";
import { answerQuestion, type Answer } from "../state/assistant";
import { decisions, quickChecks } from "./mock/today";
import { receipts } from "./mock/handled";
import { digest, tasks } from "./mock/library";
import { feeds, policies, rules } from "./mock/delegation";
import { briefing, profile, runs, settings } from "./mock/system";
import { details } from "./mock/details";
import { lifeDetails } from "./mock/lifeDetails";
import { areas, facts } from "./mock/areas";
import { report } from "./mock/report";
import { streams } from "./mock/streams";

// The one seam between the panel and the server. The real implementation
// will call the backend over HTTP; the mock returns fixed data.
export interface EmailManagerApi {
  loadAppData(): Promise<AppData>;
  // The reducer has already applied the action locally; this persists it.
  send(action: Action): Promise<void>;
  // `current` lets the mock answer from the live store; the server ignores it.
  ask(query: string, current?: AppData): Promise<Answer>;
}

export const mockApi: EmailManagerApi = {
  async loadAppData() {
    return structuredClone({ briefing, profile, areas, facts, details: { ...details, ...lifeDetails }, decisions, report, streams, snoozed: [], quickChecks, receipts, digest, tasks, policies, rules, feeds, runs, settings });
  },
  async send() {},
  async ask(query, current) {
    return answerQuestion(current ?? (await mockApi.loadAppData()), query);
  },
};
