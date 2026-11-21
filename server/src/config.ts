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

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: port(8080),
    INTERNAL_PORT: port(8081),
    DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\/.+/, "must be a postgres URL"),
    ALLOWED_EMAILS: emailList,
    INTERNAL_TOKEN: z.string().min(32),
    MAIL_PROVIDER: z.enum(["imap", "office365", "gmail"]),
    IMAP_HOST: optionalText,
    IMAP_PORT: port(993).optional(),
    IMAP_USER: optionalText,
    IMAP_PASSWORD: optionalText,
    SMTP_HOST: optionalText,
    SMTP_PORT: port(587).optional(),
    OAUTH_CLIENT_ID: optionalText,
    OAUTH_CLIENT_SECRET: optionalText,
    TOKEN_ENCRYPTION_KEY: encryptionKey.optional(),
    ANTHROPIC_API_KEY: optionalText,
    RSPAMD_URL: z.url().optional(),
    DRY_RUN: bool.default(true),
    AI_DAILY_BUDGET_USD: z.coerce.number().nonnegative().default(0.5),
    PUBLIC_URL: z.url().optional(),
  })
  .superRefine((env, ctx) => {
    const need = (names: (keyof typeof env)[]) => {
      for (const name of names) {
        if (env[name] === undefined) {
          ctx.addIssue({ code: "custom", path: [name], message: "is required for this MAIL_PROVIDER" });
        }
      }
    };
    if (env.MAIL_PROVIDER === "imap") {
      need(["IMAP_HOST", "IMAP_PORT", "IMAP_USER", "IMAP_PASSWORD"]);
    } else {
      need(["OAUTH_CLIENT_ID", "OAUTH_CLIENT_SECRET", "TOKEN_ENCRYPTION_KEY"]);
    }
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
