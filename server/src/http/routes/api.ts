import { Hono } from "hono";
import type { AskDeps } from "../../life/answerQuestion";
import type { Store } from "../../store";
import type { Db } from "../../store/db";
import { areaRoutes } from "./areas";
import { askRoutes } from "./ask";
import { decisionRoutes } from "./decisions";
import { delegationRoutes } from "./delegation";
import { digestRoutes } from "./digest";
import { factRoutes } from "./facts";
import { pickRoutes } from "./picks";
import { policyRoutes } from "./policies";
import { receiptRoutes } from "./receipts";
import { ruleRoutes } from "./rules";
import { settingsRoutes } from "./settings";
import { taskRoutes } from "./tasks";
import { todayRoutes } from "./today";

/** Everything the panel calls, to be mounted under the authed /api. */
export function apiRoutes(store: Store, db: Db, ask: AskDeps): Hono {
  const app = new Hono();
  for (const r of [
    askRoutes(ask), todayRoutes(db), delegationRoutes(store), decisionRoutes(store), receiptRoutes(db),
    digestRoutes(db), taskRoutes(store), policyRoutes(store), ruleRoutes(store), settingsRoutes(store),
    pickRoutes(store, db), factRoutes(db), areaRoutes(store),
  ]) app.route("/", r);
  return app;
}
