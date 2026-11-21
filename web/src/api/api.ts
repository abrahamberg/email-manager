import type { AppData } from "../domain/types";
import { decisions, quickChecks } from "./mock/today";
import { receipts } from "./mock/handled";
import { digest, tasks } from "./mock/library";
import { feeds, policies, rules } from "./mock/delegation";
import { briefing, profile, runs, settings } from "./mock/system";
import { details } from "./mock/details";

// The one seam between the panel and the server. The real implementation
// will call the backend over HTTP; the mock returns fixed data.
export interface EmailManagerApi {
  loadAppData(): Promise<AppData>;
}

export const mockApi: EmailManagerApi = {
  async loadAppData() {
    return structuredClone({ briefing, profile, details, decisions, snoozed: [], quickChecks, receipts, digest, tasks, policies, rules, feeds, runs, settings });
  },
};
