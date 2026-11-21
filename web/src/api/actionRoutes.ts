import type { Action } from "../state/actions";

export type HttpMethod = "POST" | "PATCH" | "DELETE";
export interface Route {
  method: HttpMethod;
  path: string;
  body?: unknown;
}

type Of<T extends Action["type"]> = Extract<Action, { type: T }>;
type RouteTable = { [T in Action["type"]]: (action: Of<T>) => Route };

const seg = encodeURIComponent;

export const actionRoutes: RouteTable = {
  "decision/accept": (a) => ({ method: "POST", path: `/api/decisions/${seg(a.id)}/accept`, body: a.edit ?? {} }),
  "decision/dismiss": (a) => ({ method: "POST", path: `/api/decisions/${seg(a.id)}/dismiss`, body: {} }),
  "decision/snooze": (a) => ({ method: "POST", path: `/api/decisions/${seg(a.id)}/snooze`, body: {} }),
  "decision/restoreSnoozed": () => ({ method: "POST", path: "/api/decisions/restore", body: {} }),
  "quickCheck/answer": (a) => ({ method: "POST", path: `/api/quick-checks/${seg(a.id)}`, body: { correct: a.correct } }),
  "receipt/undo": (a) => ({ method: "POST", path: `/api/receipts/${seg(a.id)}/undo`, body: {} }),
  "receipt/teach": (a) => ({ method: "POST", path: `/api/receipts/${seg(a.id)}/teach`, body: { always: a.always } }),
  "digest/setState": (a) => ({ method: "POST", path: `/api/digest/${seg(a.id)}`, body: { state: a.state } }),
  "digest/unsubscribeCategory": (a) => ({ method: "POST", path: "/api/digest/unsubscribe", body: { category: a.category } }),
  "task/toggle": (a) => ({ method: "POST", path: `/api/tasks/${seg(a.id)}/toggle`, body: {} }),
  "policy/setLevel": (a) => ({ method: "POST", path: `/api/policies/${seg(a.category)}/level`, body: { level: a.level } }),
  "policy/applyPreset": (a) => ({ method: "POST", path: "/api/policies/preset", body: { preset: a.preset } }),
  "rule/setStatus": (a) => ({ method: "POST", path: `/api/rules/${seg(a.id)}/status`, body: { status: a.status } }),
  "rule/save": (a) => ({ method: "POST", path: "/api/rules", body: { id: a.id, when: a.when, then: a.then } }),
  "settings/update": (a) => ({ method: "PATCH", path: "/api/settings", body: a.patch }),
  "pick/feedback": (a) => ({ method: "POST", path: `/api/picks/${seg(a.itemId)}/feedback`, body: { streamId: a.streamId, feedback: a.feedback } }),
  "fact/forget": (a) => ({ method: "DELETE", path: `/api/facts/${seg(a.id)}` }),
  "area/setNote": (a) => ({ method: "POST", path: `/api/areas/${seg(a.id)}/note`, body: { note: a.note } }),
  "area/add": (a) => ({ method: "POST", path: "/api/areas", body: { name: a.name, note: a.note } }),
};

export function routeFor(action: Action): Route {
  return (actionRoutes[action.type] as (a: Action) => Route)(action);
}
