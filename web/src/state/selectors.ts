import type { AppData, EmailRef } from "../domain/types";

export function allEmails(data: AppData): EmailRef[] {
  const sources = [
    ...data.decisions.map((decision) => decision.email),
    ...data.snoozed.map((decision) => decision.email),
    ...data.receipts.map((receipt) => receipt.email),
    ...data.tasks.map((task) => task.email),
  ];
  return [...new Map(sources.map((email) => [email.id, email])).values()];
}

export function findEmail(data: AppData, id: string): EmailRef | undefined {
  return allEmails(data).find((email) => email.id === id);
}
