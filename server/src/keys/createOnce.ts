import { open, readFile, stat } from "node:fs/promises";

const EMPTY_RETRIES = 20;
const EMPTY_WAIT_MS = 50;

const pause = (ms: number) => new Promise((done) => setTimeout(done, ms));

/**
 * Why: the file holds a key other data is sealed with, so it is created exactly once and never
 * replaced. A losing racer reads the winner's file; a file that exists but is invalid stops startup.
 */
export async function readOrCreate<T>(path: string, make: () => string, parse: (text: string) => T | undefined): Promise<T> {
  await createIfMissing(path, make);
  const value = parse(await readSettled(path));
  if (value === undefined) throw new Error(`${path} exists but is invalid; refusing to replace it (stored secrets depend on it)`);
  return value;
}

async function createIfMissing(path: string, make: () => string): Promise<void> {
  let file;
  try {
    file = await open(path, "wx", 0o600);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EEXIST") return;
    throw err;
  }
  try {
    await file.writeFile(`${make()}\n`);
    await file.sync();
  } finally {
    await file.close();
  }
}

/** Another process may have created the file and not written it yet. */
async function readSettled(path: string): Promise<string> {
  for (let i = 0; i < EMPTY_RETRIES; i++) {
    const text = (await readFile(path, "utf8")).trim();
    if (text) return text;
    await pause(EMPTY_WAIT_MS);
  }
  return "";
}

export async function requireDir(dir: string): Promise<void> {
  const info = await stat(dir).catch(() => undefined);
  if (!info?.isDirectory()) throw new Error(`DATA_DIR ${dir} is not a directory; mount the persistent volume there`);
}
