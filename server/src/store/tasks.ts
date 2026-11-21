import type { Db } from "./db";
import { orUndef } from "./convert";

export interface StoredTask {
  id: string;
  title: string;
  owner: "me" | "them";
  messageId: string;
  due?: string;
  done: boolean;
}

interface Row { id: string; title: string; owner: StoredTask["owner"]; message_id: string; due: string | null; done: boolean }

export function taskRepo(db: Db) {
  return {
    async list(): Promise<StoredTask[]> {
      const rows = await db.query<Row>("SELECT * FROM tasks ORDER BY created_at, id");
      return rows.map((r) => ({
        id: r.id, title: r.title, owner: r.owner, messageId: r.message_id, due: orUndef(r.due), done: r.done,
      }));
    },
    async create(t: Omit<StoredTask, "done"> & { done?: boolean }) {
      await db.query(
        `INSERT INTO tasks (id, title, owner, message_id, due, done) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET title = $2, owner = $3, message_id = $4, due = $5, done = $6`,
        [t.id, t.title, t.owner, t.messageId, t.due ?? null, t.done ?? false],
      );
    },
    /** Flips done; false when the task does not exist. */
    async toggle(id: string): Promise<boolean> {
      const rows = await db.query("UPDATE tasks SET done = NOT done WHERE id = $1 RETURNING id", [id]);
      return rows.length > 0;
    },
  };
}
