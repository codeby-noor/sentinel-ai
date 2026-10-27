import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  API_PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().default(''),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  COOKIE_SECURE: z.coerce.boolean().default(false),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  OPENAI_API_KEY: z.string().default(''),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_BASE_URL: z.string().default('https://api.openai.com/v1'),
  AI_TIMEOUT_MS: z.coerce.number().default(30000),
  SECRET_REDACT_PATTERNS: z.string().default('api_key,apikey,secret,token,password,authorization,bearer'),
  HEALTHCHECK_INTERVAL_MS: z.coerce.number().default(60000),
  HEALTHCHECK_TIMEOUT_MS: z.coerce.number().default(8000),
  HEALTHCHECK_FAILURE_THRESHOLD: z.coerce.number().default(3),
  WEB_BASE_URL: z.string().default('http://localhost:3000'),
  // ---- Email (optional SMTP for password-reset delivery) ----
  // When SMTP_HOST is empty, no email is sent; see PasswordResetService dev fallback.
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().default('no-reply@example.com'),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('Invalid environment:\n' + parsed.error.issues.map((i) => ` - ${i.path.join('.')}: ${i.message}`).join('\n'));
    throw new Error('Invalid environment configuration. See .env.example.');
  }
  cached = parsed.data;
  return cached;
}

export function isAiConfigured(env: Env = getEnv()): boolean {
  return env.OPENAI_API_KEY.length > 0;
}

export function isEmailConfigured(env: Env = getEnv()): boolean {
  return env.SMTP_HOST.length > 0;
}
