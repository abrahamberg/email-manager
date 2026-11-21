import { Hono } from "hono";
import { z } from "zod";
import type { Store } from "../../store";
import { badRequest, done, Id, notFound, parseBody } from "./validate";

export function taskRoutes(store: Store): Hono {
  return new Hono().post("/tasks/:id/toggle", async (c) => {
    if (!(await parseBody(c, z.object({}).strict()))) return badRequest(c);
    return (await store.tasks.toggle(Id(c))) ? done(c) : notFound(c);
  });
}
