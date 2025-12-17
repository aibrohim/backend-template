import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_URL: z.string().optional(),

  CORS_WHITELIST: z.string().default(''),

  SWAGGER_USERNAME: z.string().default('admin'),
  SWAGGER_PASSWORD: z.string().min(8, 'SWAGGER_PASSWORD must be at least 8 characters'),

  FRONTEND_URL: z.string().url().optional(),
  PASSWORD_RESET_URL: z.string().url().optional(),
  EMAIL_VERIFICATION_URL: z.string().url().optional(),

  // AWS SES Configuration
  AWS_REGION: z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  MAIL_FROM: z.string().email().optional(),

  // Cloudflare R2 Configuration
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.string().url().optional(),

  // Upload Configuration
  MAX_FILE_SIZE: z.coerce.number().default(10 * 1024 * 1024),
  ALLOWED_MIME_TYPES: z
    .string()
    .default('image/jpeg,image/png,image/gif,image/webp,application/pdf'),

  SUPERADMIN_EMAIL: z.string().email().optional(),
  SUPERADMIN_PASSWORD: z.string().optional(),
  SUPERADMIN_FULL_NAME: z.string().optional(),

  ENABLE_REQUEST_LOGGING: z.string().default('true'),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `  - ${issue.path.join('.')}: ${issue.message}`,
    );
    throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
  }

  return result.data;
}
