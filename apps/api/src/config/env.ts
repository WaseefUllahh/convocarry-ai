import { z } from 'zod';
import * as dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_PROVIDER: z.enum(['supabase', 'firebase']).default('supabase'),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  APP_BASE_URL: z.string().url().default('https://convocarryai.vercel.app'),
  EXTENSION_ID: z.string().optional(), // For CORS
  ENCRYPTION_KEY: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  ENABLE_DEV_LOGIN: z.string().default('false'),
  API_PORT: z.string().regex(/^\d+$/).default('3001'),
  API_HOST: z.string().default('0.0.0.0'),
  CORS_ORIGIN: z.string().default('https://convocarryai.vercel.app'),
  JWT_SECRET: z.string().min(32).default('fallback-secret-for-development-only-must-be-32-bytes'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CRON_SECRET: z.string().min(16).default('fallback-cron-secret-16-bytes'),
  STRIPE_SECRET_KEY: z.string().default('sk_test_123'),
  STRIPE_WEBHOOK_SECRET: z.string().default('whsec_123'),
  STRIPE_PRO_PRICE_ID: z.string().default('price_pro'),
  STRIPE_TEAM_PRICE_ID: z.string().default('price_team'),
  STRIPE_PORTAL_RETURN_URL: z.string().default('https://convocarryai.vercel.app/dashboard'),
  STRIPE_CHECKOUT_SUCCESS_URL: z.string().default('https://convocarryai.vercel.app/dashboard?checkout=success'),
  STRIPE_CHECKOUT_CANCEL_URL: z.string().default('https://convocarryai.vercel.app/dashboard?checkout=canceled'),
}).refine(data => {
  if (data.AUTH_PROVIDER === 'supabase') {
    return !!data.SUPABASE_URL && !!data.SUPABASE_SERVICE_ROLE_KEY;
  } else {
    return !!data.FIREBASE_PROJECT_ID && !!data.FIREBASE_SERVICE_ACCOUNT_JSON;
  }
}, {
  message: "Missing auth provider credentials (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY or FIREBASE vars)",
  path: ['AUTH_PROVIDER'],
});

export const env = envSchema.parse(process.env);
