import type { Email } from "../mail/Email";
import type { Embedder, Triage } from "../ports";
import { cosine } from "../search/cosine";
import { entityKeys } from "./entityKeys";

export const SIMILARITY_THRESHOLD = 0.82;

/** An open matter with what assignment needs; the store must supply threadIds, keys and vector. */
export interface MatterCandidate {
  id: string;
  title: string;
  areaId?: string;
  threadIds: string[];
  keys: string[];
  vector?: number[];
}

export interface Assignment {
  matterId?: string;
  create?: { title: string; areaId?: string; keys: string[]; vector?: number[] };
}

export interface AssignInput {
  email: Pick<Email, "threadId" | "from" | "headers" | "subject">;
  triage: Pick<Triage, "tier" | "areaId" | "matter">;
  matters: MatterCandidate[];
  embedder: Embedder;
}

const byId = (a: MatterCandidate, b: MatterCandidate) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function byThread(matters: MatterCandidate[], threadId: string) {
  return matters.find((m) => m.threadIds.includes(threadId));
}

function byEntity(inArea: MatterCandidate[], keys: string[]) {
  return inArea.find((m) => keys.some((k) => m.keys.includes(k)));
}

function nearest(inArea: MatterCandidate[], vector: number[]) {
  let best: { m: MatterCandidate; score: number } | undefined;
  for (const m of inArea) {
    const score = m.vector ? cosine(vector, m.vector) : 0;
    if (score >= SIMILARITY_THRESHOLD && (!best || score > best.score)) best = { m, score };
  }
  return best?.m;
}

const embedText = (input: AssignInput) => [input.triage.matter, input.email.subject].filter(Boolean).join("\n");

function canCreate(triage: AssignInput["triage"]): triage is AssignInput["triage"] & { matter: string } {
  return triage.tier !== "notWorth" && !!triage.matter?.trim();
}

/** Thread first, then a shared entity, then the nearest embedding, else a new matter. */
export async function assignMatter(input: AssignInput): Promise<Assignment> {
  const { email, triage } = input;
  const matters = [...input.matters].sort(byId);
  const thread = byThread(matters, email.threadId);
  if (thread) return { matterId: thread.id };

  const inArea = matters.filter((m) => m.areaId === triage.areaId);
  const keys = entityKeys(email, triage);
  const entity = byEntity(inArea, keys);
  if (entity) return { matterId: entity.id };

  const hasVectors = inArea.some((m) => m.vector);
  const creating = canCreate(triage);
  if (!hasVectors && !creating) return {};
  const [vector] = await input.embedder.embed([embedText(input)]);
  const near = vector && nearest(inArea, vector);
  if (near) return { matterId: near.id };

  if (!creating) return {};
  return { create: { title: triage.matter.trim(), areaId: triage.areaId, keys, vector } };
}
