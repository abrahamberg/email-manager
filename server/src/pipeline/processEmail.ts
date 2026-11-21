import type { Email } from "../mail/Email";
import type { Classifier, SenderStats, SpamCheck } from "../ports";
import { isLowValue } from "../lowValue/isLowValue";
import type { Rule } from "../rules/Rule";
import { matchRules } from "../rules/matchRules";
import { isSpam } from "../spam/isSpam";
import { addToDigest, applyDecision, keepInInbox, moveToJunk, ruleDecision, type ApplyDeps, type Decision } from "./outcomes";
import { triageWithAi } from "./triageHook";

export interface ProcessDeps extends ApplyDeps {
  spamCheck: SpamCheck;
  rules: Rule[];
  sender: SenderStats | undefined;
  recentHashes: bigint[];
  classifier?: Classifier;
}

export async function processEmail(email: Email, raw: Uint8Array, deps: ProcessDeps): Promise<Decision> {
  return applyDecision(await decide(email, raw, deps), email, deps);
}

async function decide(email: Email, raw: Uint8Array, deps: ProcessDeps): Promise<Decision> {
  const spam = await isSpam(email, raw, deps.spamCheck);
  if (spam.spam) return moveToJunk(`${spam.reason}.`);

  const rule = matchRules(email, deps.rules, deps.clock.now());
  if (rule) return ruleDecision(rule.then, rule.id);

  const lowValue = isLowValue(email, deps.sender, deps.recentHashes);
  if (lowValue.lowValue) return addToDigest("headers", lowValue.reason);

  if (deps.classifier) return triageWithAi(email, deps.classifier);
  return keepInInbox("headers", "No spam, rule or low-value signal, so it stays in the inbox.");
}
