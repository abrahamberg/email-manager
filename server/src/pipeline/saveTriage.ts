import type { Category, Decision as PanelDecision, EmailRef, Fact } from "@email-manager/shared";
import { compactEmail } from "../ai/compactEmail";
import { assignMatter, type Assignment } from "../life/assignMatter";
import type { Email } from "../mail/Email";
import type { Clock, Triage } from "../ports";
import type { LifeRun } from "./lifeDeps";

export async function saveMessage(email: Email, at: { category?: Category; areaId?: string }, life: LifeRun): Promise<string> {
  const compactText = compactEmail(email).text;
  await life.store.messages.save({
    messageId: email.messageId, uid: email.uid, threadId: email.threadId, fromAddress: email.from.address,
    fromName: email.from.name, subject: email.subject, receivedAt: email.date, category: at.category,
    areaId: at.areaId, compactText, ...(life.mailboxId ? { mailboxId: life.mailboxId } : {}),
  });
  return compactText;
}

/** Returns the matter title, for the decision. */
export async function saveMatter(email: Email, triage: Triage, life: LifeRun, clock: Clock): Promise<string | undefined> {
  const matters = await life.store.matters.openCandidates();
  const assigned: Assignment = await assignMatter({ email, triage, matters, embedder: life.embedder });
  if (assigned.matterId) {
    await life.store.matters.attach(assigned.matterId, email.messageId);
    return matters.find((m) => m.id === assigned.matterId)?.title;
  }
  if (!assigned.create) return undefined;
  const id = `matter:${email.messageId}`;
  const { title, areaId, keys, vector } = assigned.create;
  await life.store.matters.save({ id, title, areaId, keys, vector, summary: "", status: "open", updatedAt: clock.now().toISOString() });
  await life.store.matters.attach(id, email.messageId);
  return title;
}

/** Facts belong to an area; without one there is nowhere to show them. */
export async function saveFacts(email: Email, triage: Triage, life: LifeRun): Promise<Fact[]> {
  if (!triage.areaId) return [];
  const facts = triage.facts.map((f, i): Fact => ({ ...f, id: `${email.messageId}#fact${i}`, areaId: triage.areaId!, sourceEmailId: email.messageId }));
  for (const fact of facts) await life.store.facts.save(fact);
  return facts;
}

export interface DecisionInput {
  email: Email;
  triage: Triage;
  matter?: string;
  snippet: string;
  draft?: { text: string; confidence: number };
}

/** Don't-miss mail and anything that wants a reply goes to the panel as a pending decision. */
export async function saveDecision(input: DecisionInput, life: LifeRun): Promise<void> {
  const { email, triage, draft } = input;
  if (triage.tier !== "dontMiss" && !triage.needsReply) return;
  const base = {
    id: `decision:${email.messageId}`,
    email: emailRef(input),
    matter: triage.matter ?? input.matter ?? email.subject,
    need: triage.need ?? triage.why,
    why: triage.why,
    ...(triage.deadline ? { deadline: triage.deadline } : {}),
  };
  const decision: PanelDecision = triage.needsReply
    ? { ...base, kind: "reply", draft: draft?.text ?? "", confidence: draft?.confidence ?? 0 }
    : { ...base, kind: "task", title: base.need, ...(triage.deadline ? { due: triage.deadline } : {}) };
  await life.store.decisions.add(decision);
}

function emailRef({ email, triage, snippet }: DecisionInput): EmailRef {
  return {
    id: email.messageId,
    from: { name: email.from.name ?? email.from.address, address: email.from.address },
    subject: email.subject,
    receivedAt: email.date,
    snippet: snippet.slice(0, 160),
    category: triage.category,
    ...(triage.areaId ? { areaId: triage.areaId } : {}),
  };
}
