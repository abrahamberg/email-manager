import type { Stream, StreamItem } from "@email-manager/shared";
import type { Email } from "../mail/Email";
import type { SenderStats } from "../ports";
import { detectStream, type StreamId } from "../streams/detectStream";
import { matchInterests, summariseRest, type Matches, type Pick } from "../streams/matchInterests";
import { splitItems, type ExtractedItem } from "../streams/splitItems";
import type { LifeRun } from "./lifeDeps";
import { addToDigest, type Decision } from "./outcomes";
import { saveMessage } from "./saveTriage";

/** detectStream is the bulk check here: it also counts "jobs-noreply" style senders. The count includes this message. */
export function streamOf(email: Email, sender: SenderStats | undefined): StreamId | undefined {
  return detectStream(email, { messages: (sender?.received ?? 0) + 1 });
}

export async function handleStream(email: Email, stream: StreamId, life: LifeRun): Promise<Decision> {
  const items = await splitItems(email, life.extract);
  const { picks, rest } = await safeMatch(items, life);
  const digest = addToDigest("headers", `Stream ${stream.name}: ${items.length} items, ${picks.length} picked for you.`);
  await saveMessage(email, { category: "newsletter", areaId: picks[0]?.areaId }, life);
  if (picks.length === 0) return { ...digest, tier: "notWorth" };

  const whys = await writeWhys(stream.name, picks, life);
  await life.store.streams.save(toStream(email, stream, items.length, picks, whys, rest));
  return { ...digest, tier: "worthKnowing", areaId: picks[0]!.areaId };
}

async function safeMatch(items: ExtractedItem[], life: LifeRun): Promise<Matches> {
  try {
    return await matchInterests(items, await life.interests(), life.embedder);
  } catch {
    // No vectors (embedder down) leaves nothing to compare: no picks this time.
    return { picks: [], rest: summariseRest(items) };
  }
}

const plainWhy = (p: Pick) => `Matches your interest: ${p.interest}`.slice(0, 140);

/** One small AI call for the run's first few picks; everything else gets the plain line. */
async function writeWhys(name: string, picks: Pick[], life: LifeRun): Promise<string[]> {
  const plain = picks.map(plainWhy);
  if (!life.writeWhy) return plain;
  const slots = life.takeWhySlots(picks.length);
  if (slots === 0) return plain;
  const top = picks.slice(0, slots).map((p) => ({ title: p.item.title, facts: p.item.facts, interest: p.interest }));
  const lines = await life.writeWhy(name, top).catch(() => undefined);
  return plain.map((line, i) => lines?.[i]?.trim() || line);
}

function toStream(email: Email, s: StreamId, total: number, picks: Pick[], whys: string[], rest: string): Stream {
  const items: StreamItem[] = picks.map((p, i) => ({
    id: `${email.messageId}#${i}`,
    title: p.item.title,
    facts: p.item.facts,
    why: whys[i]!,
    ...(p.item.closes ? { closes: p.item.closes } : {}),
  }));
  return {
    id: s.streamKey,
    name: s.name,
    areaId: picks[0]!.areaId,
    emailId: email.messageId,
    period: email.date.slice(0, 10),
    total,
    picks: items,
    rest,
  };
}
