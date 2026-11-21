import type { Area } from "@email-manager/shared";
import type { Db } from "./db";
import { json, orUndef } from "./convert";

interface Row {
  id: string; short_name: string; kind: Area["kind"]; name: string; summary: string;
  note: string | null; people: Area["people"];
}

const toArea = (r: Row): Area => ({
  id: r.id, shortName: r.short_name, kind: r.kind, name: r.name, summary: r.summary,
  note: orUndef(r.note), people: r.people,
});

export function areaRepo(db: Db) {
  return {
    async save(a: Area) {
      await db.query(
        `INSERT INTO areas (id, short_name, kind, name, summary, note, people) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
         ON CONFLICT (id) DO UPDATE SET short_name = $2, kind = $3, name = $4, summary = $5, note = $6, people = $7::jsonb`,
        [a.id, a.shortName, a.kind, a.name, a.summary, a.note ?? null, json(a.people)],
      );
    },
    async list(): Promise<Area[]> {
      return (await db.query<Row>("SELECT * FROM areas ORDER BY name")).map(toArea);
    },
    async get(id: string): Promise<Area | undefined> {
      const [r] = await db.query<Row>("SELECT * FROM areas WHERE id = $1", [id]);
      return r && toArea(r);
    },
    async setNote(id: string, note: string) {
      await db.query("UPDATE areas SET note = $2 WHERE id = $1", [id, note]);
    },
    async remove(id: string) {
      await db.query("DELETE FROM areas WHERE id = $1", [id]);
    },
  };
}
