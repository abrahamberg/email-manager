import type { Fact } from "@email-manager/shared";
import type { Db } from "./db";
import { isoOrUndef, orUndef } from "./convert";

interface Row {
  id: string; area_id: string; kind: Fact["kind"]; title: string; detail: string;
  at: unknown; place: string | null; source_email_id: string | null;
}

const toFact = (r: Row): Fact => ({
  id: r.id, areaId: r.area_id, kind: r.kind, title: r.title, detail: r.detail,
  at: isoOrUndef(r.at), place: orUndef(r.place), sourceEmailId: orUndef(r.source_email_id),
});

export function factRepo(db: Db) {
  return {
    async save(f: Fact) {
      await db.query(
        `INSERT INTO facts (id, area_id, kind, title, detail, at, place, source_email_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET area_id = $2, kind = $3, title = $4, detail = $5, at = $6, place = $7`,
        [f.id, f.areaId, f.kind, f.title, f.detail, f.at ?? null, f.place ?? null, f.sourceEmailId ?? null],
      );
    },
    async list(areaId?: string): Promise<Fact[]> {
      const rows = areaId
        ? await db.query<Row>("SELECT * FROM facts WHERE area_id = $1 ORDER BY at NULLS LAST, id", [areaId])
        : await db.query<Row>("SELECT * FROM facts ORDER BY at NULLS LAST, id");
      return rows.map(toFact);
    },
    async remove(id: string) {
      await db.query("DELETE FROM facts WHERE id = $1", [id]);
    },
  };
}
