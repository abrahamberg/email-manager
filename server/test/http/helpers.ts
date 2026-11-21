import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Run } from "@email-manager/shared";
import { createApp } from "../../src/http/app";

export const RUN: Run = {
  id: "r1", startedAt: "2026-11-20T10:00:00.000Z", durationSec: 3, fetched: 4,
  handledByLogic: 3, sentToAi: 1, tokens: 100, costUsd: 0.01,
};

/** A static root with an index, an asset, and a secret file next to (outside) it. */
export function staticFixture(): string {
  const dir = mkdtempSync(join(tmpdir(), "em-static-"));
  writeFileSync(join(dir, "secret.txt"), "TOP-SECRET");
  const root = join(dir, "public");
  mkdirSync(join(root, "assets"), { recursive: true });
  writeFileSync(join(root, "index.html"), "<!doctype html><title>panel</title>");
  writeFileSync(join(root, "assets", "app.js"), "console.log(1)");
  return root;
}

export function testApp(runs: () => Promise<Run[]> = async () => [RUN]) {
  return createApp({
    allowedEmails: ["owner@example.com"],
    runs: { recent: runs },
    staticDir: staticFixture(),
  });
}

export const as = (email: string) => ({ headers: { "X-Auth-Request-Email": email } });
