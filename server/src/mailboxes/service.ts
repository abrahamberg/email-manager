import { randomUUID } from "node:crypto";
import { decrypt, encrypt } from "../mail/auth/crypto";
import type { Store } from "../store";
import type { MailboxRecord, MailboxRepo, SealedSecrets } from "../store/mailboxes";
import type { MailboxInput } from "./input";
import { planSave, type SaveError } from "./planSave";

/** A mailbox with its secrets opened, for wiring a connection. Never sent to the panel. */
export interface OpenedMailbox {
  record: MailboxRecord;
  clientSecret?: string;
  password?: string;
}

export type MailboxView = MailboxRecord & { connected: boolean };
export type SaveResult = { ok: true; mailbox: MailboxView } | { ok: false; error: SaveError | "not_found" };

export interface MailboxAdmin {
  list(): Promise<MailboxView[]>;
  create(input: MailboxInput): Promise<SaveResult>;
  update(id: string, input: MailboxInput): Promise<SaveResult>;
  remove(id: string): Promise<boolean>;
}

const seal = (plain: string | undefined, key: Buffer) => (plain === undefined ? undefined : encrypt(plain, key));
const unseal = (sealed: string | undefined, key: Buffer) => (sealed === undefined ? undefined : decrypt(sealed, key));

export function openSecrets(record: MailboxRecord, sealed: SealedSecrets, key: Buffer): OpenedMailbox {
  return { record, clientSecret: unseal(sealed.clientSecret, key), password: unseal(sealed.password, key) };
}

export function mailboxService(repo: MailboxRepo, tokens: Store["tokens"], key: Buffer, newId: () => string = randomUUID) {
  const view = async (m: MailboxRecord): Promise<MailboxView> =>
    ({ ...m, connected: m.provider !== "imap" && Boolean(await tokens.get(m.id)) });

  async function save(id: string, input: MailboxInput, existing?: MailboxRecord): Promise<SaveResult> {
    const plan = planSave(id, input, existing);
    if ("error" in plan) return { ok: false, error: plan.error };
    await repo.save(plan.write, { clientSecret: seal(plan.secrets.clientSecret, key), password: seal(plan.secrets.password, key) });
    const saved = await repo.get(id);
    return saved ? { ok: true, mailbox: await view(saved) } : { ok: false, error: "not_found" };
  }

  const admin: MailboxAdmin = {
    list: async () => Promise.all((await repo.list()).map(view)),
    create: (input) => save(newId(), input),
    async update(id, input) {
      const existing = await repo.get(id);
      return existing ? save(id, input, existing) : { ok: false, error: "not_found" };
    },
    async remove(id) {
      if (!(await repo.get(id))) return false;
      await repo.remove(id);
      return true;
    },
  };
  return {
    admin,
    async opened(id: string): Promise<OpenedMailbox | undefined> {
      const found = await repo.withSecrets(id);
      return found && openSecrets(found.mailbox, found.sealed, key);
    },
    async enabled(): Promise<OpenedMailbox[]> {
      return (await repo.enabledWithSecrets()).map((f) => openSecrets(f.mailbox, f.sealed, key));
    },
  };
}

export type MailboxService = ReturnType<typeof mailboxService>;
