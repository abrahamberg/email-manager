import type { ImapClient } from "./client.js";

export type FolderRole = "junk" | "archive" | "drafts";
export type Folders = { inbox: string } & Record<FolderRole, string>;

const specialUse: Record<FolderRole, string> = {
  junk: "\\Junk",
  archive: "\\Archive",
  drafts: "\\Drafts",
};

// Office 365 and Gmail names first, then the usual generic ones.
const commonNames: Record<FolderRole, string[]> = {
  junk: ["Junk Email", "Junk E-mail", "[Gmail]/Spam", "Junk", "Spam", "INBOX.Junk", "INBOX.Spam"],
  archive: ["Archive", "[Gmail]/All Mail", "Archives", "INBOX.Archive"],
  drafts: ["Drafts", "[Gmail]/Drafts", "Draft", "INBOX.Drafts"],
};

const roles: FolderRole[] = ["junk", "archive", "drafts"];

/** Explicit overrides win, then SPECIAL-USE, then common names, else the folder is created. */
export async function resolveFolders(client: ImapClient, overrides: Partial<Folders> = {}): Promise<Folders> {
  const listed = await client.list();
  const folders: Folders = { inbox: overrides.inbox ?? "INBOX", junk: "", archive: "", drafts: "" };
  for (const role of roles) {
    folders[role] = overrides[role] ?? (await findOrCreate(client, listed, role));
  }
  return folders;
}

type Listed = Awaited<ReturnType<ImapClient["list"]>>;

async function findOrCreate(client: ImapClient, listed: Listed, role: FolderRole): Promise<string> {
  const bySpecialUse = listed.find((f) => f.specialUse === specialUse[role] || f.flags.has(specialUse[role]));
  if (bySpecialUse) return bySpecialUse.path;
  const byName = findByName(listed, commonNames[role]);
  if (byName) return byName;
  const created = await client.mailboxCreate(defaultName(role));
  return created.path;
}

function findByName(listed: Listed, names: string[]): string | undefined {
  for (const name of names) {
    const hit = listed.find((f) => f.path.toLowerCase() === name.toLowerCase());
    if (hit) return hit.path;
  }
  return undefined;
}

const defaultName = (role: FolderRole) => (role === "junk" ? "Junk" : role === "archive" ? "Archive" : "Drafts");
