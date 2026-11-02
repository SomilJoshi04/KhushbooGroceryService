/**
 * Environment configuration — validated at startup.
 *
 * Import this module FIRST in server.js (after dotenv.config()).
 * The process will exit(1) with a clear message if required variables
 * are missing or malformed. Credential values are NEVER logged.
 *
 * @module config/env
 */

import { z } from 'zod';

/** Allowed NODE_ENV values */
const NODE_ENV_VALUES = ['development', 'test', 'staging', 'production'];

const envSchema = z.object({
  // ── Server ──────────────────────────────────────────────────────────────────
  NODE_ENV: z
    .enum(NODE_ENV_VALUES)
    .default('development'),

  PORT: z
    .string()
    .regex(/^\d+$/, 'PORT must be a numeric string')
    .transform(Number)
    .default('5000'),

  // ── Database ─────────────────────────────────────────────────────────────────
  MONGO_URI: z
    .string()
    .min(10, 'MONGO_URI must be a valid MongoDB connection string')
    .refine(
      (v) => v.startsWith('mongodb://') || v.startsWith('mongodb+srv://'),
      { message: 'MONGO_URI must start with mongodb:// or mongodb+srv://' }
    ),

  // ── CORS ─────────────────────────────────────────────────────────────────────
  CLIENT_URL: z
    .string()
    .url('CLIENT_URL must be a valid URL')
    .default('http://localhost:5173'),

  // ── Auth & JWT ──────────────────────────────────────────────────────────────
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters for cryptographic safety'),

  JWT_EXPIRES_IN: z
    .string()
    .default('7d'),

  // ── Administrator Credentials ─────────────────────────────────────────────
  ADMIN_EMAIL: z
    .string({
      required_error: 'ADMIN_EMAIL is required in environment variables',
      invalid_type_error: 'ADMIN_EMAIL must be a string',
    })
    .trim()
    .min(1, 'ADMIN_EMAIL is required')
    .email('ADMIN_EMAIL must be a valid email address')
    .transform((v) => v.toLowerCase())
    .refine(
      (v) =>
        !v.includes('placeholder') &&
        !v.includes('your_') &&
        !v.includes('example.com'),
      { message: 'ADMIN_EMAIL cannot be an unresolved placeholder' }
    ),

  ADMIN_PASSWORD: z
    .string({
      required_error: 'ADMIN_PASSWORD is required in environment variables',
      invalid_type_error: 'ADMIN_PASSWORD must be a string',
    })
    .min(8, 'ADMIN_PASSWORD must be at least 8 characters long')
    .refine(
      (v) =>
        !v.includes('placeholder') &&
        !v.includes('your_password') &&
        !v.includes('your_admin_password') &&
        v !== 'password' &&
        v !== '12345678',
      { message: 'ADMIN_PASSWORD cannot be a trivial or unresolved placeholder' }
    ),

  ADMIN_PHONE: z
    .string({
      required_error: 'ADMIN_PHONE is required in environment variables',
      invalid_type_error: 'ADMIN_PHONE must be a string',
    })
    .trim()
    .min(1, 'ADMIN_PHONE is required')
    .transform((val) => {
      const cleaned = val.replace(/[\s\-()]/g, '');
      if (/^\+91[6-9]\d{9}$/.test(cleaned)) return cleaned;
      if (/^91[6-9]\d{9}$/.test(cleaned)) return `+${cleaned}`;
      if (/^0[6-9]\d{9}$/.test(cleaned)) return `+91${cleaned.slice(1)}`;
      if (/^[6-9]\d{9}$/.test(cleaned)) return `+91${cleaned}`;
      return cleaned;
    })
    .refine((val) => /^\+91[6-9]\d{9}$/.test(val), {
      message: 'ADMIN_PHONE must be a valid 10-digit Indian phone number (e.g. +91XXXXXXXXXX or 9XXXXXXXXX)',
    }),

  // ── OTP Configuration ───────────────────────────────────────────────────────
  OTP_TTL_MINUTES: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .default('5'),

  OTP_MAX_ATTEMPTS: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .default('5'),

  OTP_RESEND_COOLDOWN_SECONDS: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .default('45'),

  OTP_LENGTH: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .refine((n) => n >= 4 && n <= 8, {
      message: 'OTP_LENGTH must be between 4 and 8 digits',
    })
    .default('4'),

  USE_DEV_OTP: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),

  DEV_OTP: z
    .string()
    .regex(/^\d{4,8}$/)
    .default('1234'),

  // ── Store Location & Delivery Zone (Indore, M.P.) ──────────────────────────
  STORE_CITY: z.string().default('Indore'),
  STORE_STATE: z.string().default('Madhya Pradesh'),
  STORE_PINCODE: z.string().regex(/^\d{6}$/).default('452001'),
  STORE_LAT: z.string().transform(Number).default('22.7196'),
  STORE_LNG: z.string().transform(Number).default('75.8577'),
  MAX_DELIVERY_DISTANCE_KM: z.string().transform(Number).default('15'),
  FREE_DELIVERY_THRESHOLD_PAISE: z.string().transform(Number).default('49900'),
  MIN_ORDER_AMOUNT_PAISE: z.string().transform(Number).default('1000'),
  // ── Online Payments (Phase 7 - Razorpay) ──────────────────────────────────
  RAZORPAY_KEY_ID: z.string().default('rzp_test_placeholder_key_id'),
  RAZORPAY_KEY_SECRET: z.string().default('placeholder_razorpay_secret'),
  RAZORPAY_WEBHOOK_SECRET: z.string().default('placeholder_webhook_secret'),
  ALLOW_DEV_PAYMENT_SIMULATION: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),

  // ── Local File Storage ────────────────────────────────────────────────────
  STORAGE_PROVIDER: z.enum(['local']).default('local'),
  UPLOAD_DIR: z.string().default('uploads'),
  MAX_IMAGE_SIZE_MB: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .default('5'),
  MAX_DOCUMENT_SIZE_MB: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .default('10'),
  PUBLIC_BASE_URL: z.string().default(''),
}).refine((data) => {
  // In production, USE_DEV_OTP must NEVER be enabled!
  if (data.NODE_ENV === 'production' && data.USE_DEV_OTP) {
    return false;
  }
  return true;
}, {
  message: 'USE_DEV_OTP cannot be true in production environment!',
  path: ['USE_DEV_OTP'],
}).refine((data) => {
  // In production, payment simulation must NEVER be enabled!
  if (data.NODE_ENV === 'production' && data.ALLOW_DEV_PAYMENT_SIMULATION) {
    return false;
  }
  return true;
}, {
  message: 'ALLOW_DEV_PAYMENT_SIMULATION cannot be true in production environment!',
  path: ['ALLOW_DEV_PAYMENT_SIMULATION'],
}).refine((data) => {
  // In production, JWT_SECRET cannot be a known development placeholder!
  if (data.NODE_ENV === 'production' && data.JWT_SECRET.includes('khushboo_dev_jwt_secret')) {
    return false;
  }
  return true;
}, {
  message: 'Production JWT_SECRET cannot use the development placeholder key!',
  path: ['JWT_SECRET'],
}).refine((data) => {
  // In production, ADMIN_PASSWORD must be at least 10 characters long
  if (data.NODE_ENV === 'production' && data.ADMIN_PASSWORD.length < 10) {
    return false;
  }
  return true;
}, {
  message: 'In production, ADMIN_PASSWORD must be at least 10 characters long for robust security!',
  path: ['ADMIN_PASSWORD'],
});

/**
 * Parse and validate process.env.  Exits on failure.
 * @returns {z.infer<typeof envSchema>} Validated env object
 */
function parseEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
      .join('\n');

    // Print names of bad vars but NEVER their values.
    console.error(
      '[startup] ❌ Environment validation failed. Fix the following variables:\n' +
        issues +
        '\nHint: Copy backend/.env.example → backend/.env and fill in real values.'
    );
    process.exit(1);
  }

  return result.data;
}

export const env = parseEnv();
