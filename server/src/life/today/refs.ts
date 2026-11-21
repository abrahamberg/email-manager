import type { Category, EmailRef } from "@email-manager/shared";
import type { OutcomeRecord } from "../../ports";
import type { MessageRow } from "./queries";

export function emailRef(id: string, m: MessageRow | undefined, fallback: { areaId?: string; at: string }): EmailRef {
  return {
    id,
    from: m?.from ?? { name: "Unknown sender", address: "" },
    subject: m?.subject ?? "",
    receivedAt: m?.receivedAt ?? fallback.at,
    snippet: m ? m.compactText.slice(0, 160) : "",
    category: m?.category ?? ("notification" as Category),
    areaId: m?.areaId ?? fallback.areaId,
  };
}

export function refForOutcome(o: OutcomeRecord, msgs: Map<string, MessageRow>): EmailRef {
  return emailRef(o.messageId, msgs.get(o.messageId), { areaId: o.areaId, at: o.at });
}
