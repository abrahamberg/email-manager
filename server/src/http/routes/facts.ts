import { Hono } from "hono";
import type { Db } from "../../store/db";
import { factExists, forgetFact } from "../queries/misc";
import { done, Id, notFound } from "./validate";

export function factRoutes(db: Db): Hono {
  return new Hono().delete("/facts/:id", async (c) => {
    if (!(await factExists(db, Id(c)))) return notFound(c);
    await forgetFact(db, Id(c));
    return done(c);
  });
}
