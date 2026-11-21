import type { AppData, Category, DigestGroup, Settings } from "../domain/types";

export function setDigestState(data: AppData, id: string, state: DigestGroup["state"]): AppData {
  return { ...data, digest: data.digest.map((group) => (group.id === id ? { ...group, state } : group)) };
}

export function unsubscribeCategory(data: AppData, category: Category): AppData {
  return {
    ...data,
    digest: data.digest.map((group) => (group.category === category ? { ...group, state: "unsubscribed" } : group)),
  };
}

export function toggleTask(data: AppData, id: string): AppData {
  return { ...data, tasks: data.tasks.map((task) => (task.id === id ? { ...task, done: !task.done } : task)) };
}

export function updateSettings(data: AppData, patch: Partial<Settings>): AppData {
  return { ...data, settings: { ...data.settings, ...patch } };
}
