import { compactEmail } from "../ai/compactEmail";
import type { Email } from "../mail/Email";
import type { Classifier, Mailbox, SenderStats, Triage } from "../ports";
import { draftIfNeeded } from "./draftIfNeeded";
import { indexForSearch } from "./indexForSearch";
import type { LifeRun } from "./lifeDeps";
import { addToDigest, keepInInbox, type ApplyDeps, type Decision } from "./outcomes";
import { saveDecision, saveFacts, saveMatter, saveMessage } from "./saveTriage";

export interface TriageDeps extends ApplyDeps {
  classifier: Classifier;
  life?: LifeRun;
  sender: SenderStats | undefined;
  mailbox: Mailbox;
}

/** Phase 2: the only place the model is asked. */
export async function triageWithAi(email: Email, deps: TriageDeps): Promise<Decision> {
  const { life } = deps;
  const areas = life ? await life.areas() : [];
  const compact = compactEmail(email);
  const triage = await deps.classifier.triage(compact, { areas: areas.map(({ id, name, note }) => ({ id, name, note })) });
  if (!life) return keepInInbox("ai", triage.why, triage.confidence);

  const compactText = await saveMessage(email, { category: triage.category, areaId: triage.areaId }, life);
  const matter = await saveMatter(email, triage, life, deps.clock);
  const facts = await saveFacts(email, triage, life);
  const draft = await draftIfNeeded(email, compact, triage, { ...deps, life, now: deps.clock.now() });
  await saveDecision({ email, triage, matter, snippet: compactText, draft }, life);
  await indexForSearch(email.messageId, compactText, facts, life);
  return tierDecision(triage, areas.find((a) => a.id === triage.areaId)?.name);
}

export function tierDecision(triage: Triage, areaName: string | undefined): Decision {
  const tagged = { tier: triage.tier, ...(triage.areaId ? { areaId: triage.areaId } : {}) };
  switch (triage.tier) {
    case "notWorth":
      return { ...addToDigest("ai", triage.why), confidence: triage.confidence, ...tagged };
    case "worthKnowing":
      if (areaName) {
        return { outcome: "labeled", signal: "ai", reason: triage.why, confidence: triage.confidence, actions: [{ kind: "label", label: areaName }], ...tagged };
      }
      return { ...keepInInbox("ai", triage.why, triage.confidence), ...tagged };
    case "dontMiss":
      return { ...keepInInbox("ai", triage.why, triage.confidence), ...tagged };
  }
}
