import type { AppData } from "../domain/types";
import { newId } from "./records";

export function forgetFact(data: AppData, id: string): AppData {
  return { ...data, facts: data.facts.filter((fact) => fact.id !== id) };
}

export function setAreaNote(data: AppData, areaId: string, note: string): AppData {
  const trimmed = note.trim() || undefined;
  return { ...data, areas: data.areas.map((area) => (area.id === areaId ? { ...area, note: trimmed } : area)) };
}

export function addArea(data: AppData, name: string, note: string): AppData {
  const area = {
    id: newId("a"),
    kind: "other" as const,
    name: name.trim(),
    summary: "New. I'll group matching mail here from the next run.",
    note: note.trim() || undefined,
    people: [],
  };
  return area.name ? { ...data, areas: [...data.areas, area] } : data;
}
