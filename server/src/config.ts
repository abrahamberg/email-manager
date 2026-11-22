import { z } from "zod";

const port = (def: number) => z.coerce.number().int().min(1).max(65535).default(def);
const optionalText = z.string().trim().min(1).optional();
const bool = z
  .enum(["true", "false"])
  .transform((v) => v === "true");

const emailList = z
  .string()
  .transform((v) =>
    v
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  )
  .pipe(z.array(z.string().includes("@")).min(1));

const encryptionKey = z.string().refine((v) => {
  try {
    return Buffer.from(v, "base64").length === 32;
  } catch {
    return false;
  }
}, "must be base64 for exactly 32 bytes");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: port(8080),
  INTERNAL_PORT: port(8081),
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\/.+/, "must be a postgres URL"),
  ALLOWED_EMAILS: emailList,
  /** Holds the instance keys (see keys/instanceKeys); a volume shared by the server and the worker. */
  DATA_DIR: z.string().trim().min(1).default("/data"),
  INTERNAL_TOKEN: z.string().min(32).optional(),
  TOKEN_ENCRYPTION_KEY: encryptionKey.optional(),
  OPENAI_API_KEY: optionalText,
  RSPAMD_URL: z.url().optional(),
  DRY_RUN: bool.default(true),
  AI_DAILY_BUDGET_USD: z.coerce.number().nonnegative().default(0.5),
  PUBLIC_URL: z.url().optional(),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (parsed.success) return parsed.data;
  throw new Error(`Invalid configuration:\n${formatIssues(parsed.error)}`);
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((i) => `- ${i.path.join(".") || "env"}: ${i.message}`)
    .join("\n");
}
