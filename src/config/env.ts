import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('4000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().default('file:./dev.db'),
  JWT_SECRET: z.string().min(16).default('super-secret-jwt-key-change-in-production-min-32-chars-whatsapp-os'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  AI_PROVIDER: z.enum(['gemini', 'openai', 'mock']).default('mock'),
  GEMINI_API_KEY: z.string().optional().default(''),
  OPENAI_API_KEY: z.string().optional().default(''),
  AI_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.75),
  WHATSAPP_VERIFY_TOKEN: z.string().default('pakistan_whatsapp_biz_os_verify_token_2026'),
  WHATSAPP_ACCESS_TOKEN: z.string().optional().default(''),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional().default(''),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional().default(''),
  WHATSAPP_API_VERSION: z.string().default('v20.0'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;