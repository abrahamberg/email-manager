import type { Category } from "@email-manager/shared";
import type { Db } from "./db";
import { iso, orUndef } from "./convert";

/** Headers and compact text only: there is deliberately no body field. */
export interface StoredMessage {
  messageId: string;
  uid: number;
  threadId?: string;
  fromAddress: string;
  fromName?: string;
  subject: string;
  receivedAt: string;
  category?: Category;
  areaId?: string;
  compactText: string;
  /** The mailbox it was read from; absent on rows from before mailboxes existed. */
  mailboxId?: string;
}

interface Row {
  message_id: string; uid: string | number; thread_id: string | null; from_address: string; from_name: string;
  subject: string; received_at: unknown; category: Category | null; area_id: string | null; compact_text: string;
  mailbox_id: string | null;
}

const toMessage = (r: Row): StoredMessage => ({
  messageId: r.message_id, uid: Number(r.uid), threadId: orUndef(r.thread_id), fromAddress: r.from_address,
  fromName: r.from_name, subject: r.subject, receivedAt: iso(r.received_at), category: orUndef(r.category),
  areaId: orUndef(r.area_id), compactText: r.compact_text, ...(r.mailbox_id ? { mailboxId: r.mailbox_id } : {}),
});

export function messageRepo(db: Db) {
  return {
    async save(m: StoredMessage) {
      await db.query(
        `INSERT INTO messages (message_id, uid, thread_id, from_address, from_name, subject, received_at, category, area_id, compact_text,
           mailbox_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (message_id) DO UPDATE SET uid = $2, thread_id = $3, category = $8, area_id = $9, compact_text = $10,
           mailbox_id = COALESCE($11, messages.mailbox_id)`,
        [m.messageId, m.uid, m.threadId ?? null, m.fromAddress, m.fromName ?? "", m.subject, m.receivedAt,
          m.category ?? null, m.areaId ?? null, m.compactText, m.mailboxId ?? null],
      );
    },
    async get(messageId: string): Promise<StoredMessage | undefined> {
      const [r] = await db.query<Row>("SELECT * FROM messages WHERE message_id = $1", [messageId]);
      return r && toMessage(r);
    },
    async recent(limit: number): Promise<StoredMessage[]> {
      const rows = await db.query<Row>("SELECT * FROM messages ORDER BY received_at DESC LIMIT $1", [limit]);
      return rows.map(toMessage);
    },
    async inThread(threadId: string): Promise<StoredMessage[]> {
      const rows = await db.query<Row>("SELECT * FROM messages WHERE thread_id = $1 ORDER BY received_at", [threadId]);
      return rows.map(toMessage);
    },
  };
}
