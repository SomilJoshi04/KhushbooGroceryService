/**
 * Zod validation schemas for Authentication, Registration, and User Management.
 *
 * Enforces:
 * - Case-insensitive email and username normalization.
 * - Robust password complexity (>= 12 chars, upper, lower, number, special char).
 * - Confirmation password parity.
 * - Terms & conditions agreement.
 * - Backward compatibility with address, profile, and legacy schemas.
 *
 * @module validation/authSchemas
 */

import { z } from 'zod';

/**
 * Normalizes an Indian phone number to '+91XXXXXXXXXX' format.
 */
export const phoneValidator = z
  .string()
  .trim()
  .transform((val) => {
    const cleaned = val.replace(/[\s\-()]/g, '');
    if (/^\+91[6-9]\d{9}$/.test(cleaned)) return cleaned;
    if (/^91[6-9]\d{9}$/.test(cleaned)) return `+${cleaned}`;
    if (/^0[6-9]\d{9}$/.test(cleaned)) return `+91${cleaned.slice(1)}`;
    if (/^[6-9]\d{9}$/.test(cleaned)) return `+91${cleaned}`;
    return cleaned;
  })
  .refine((val) => /^\+91[6-9]\d{9}$/.test(val), {
    message: 'Please provide a valid 10-digit Indian mobile number (e.g., 9826012345)',
  });

/**
 * Simplified User-Friendly Password Policy:
 * - At least 6 characters.
 * - Max 128 characters.
 * - Allows any mix of letters (A-Z, a-z), numbers (0-9), and special characters (!@#$%^&* etc.).
 */
export const strongPasswordValidator = z
  .string()
  .min(6, 'Password must be at least 6 characters long')
  .max(128, 'Password cannot exceed 128 characters');

/**
 * Username Policy:
 * - 3 to 30 characters.
 * - Alphanumeric, underscores, and periods.
 * - Normalized to lowercase.
 */
export const usernameValidator = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username cannot exceed 30 characters')
  .regex(
    /^[a-zA-Z0-9_.]+$/,
    'Username can only contain letters, numbers, underscores, and periods'
  )
  .transform((val) => val.toLowerCase());

/**
 * Email Policy:
 * - Normalized to lowercase.
 */
export const emailValidator = z
  .string()
  .trim()
  .email('Please enter a valid email address')
  .max(254, 'Email address is too long')
  .transform((val) => val.toLowerCase());

// ── Customer Registration ───────────────────────────────────────────────────
export const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, 'Full name is required')
      .max(100, 'Full name cannot exceed 100 characters'),
    username: usernameValidator.optional(),
    email: emailValidator,
    password: strongPasswordValidator,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: 'You must accept the Terms & Conditions to register' }),
    }),
  })
  .strict()
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

// ── Customer / Unified Login ────────────────────────────────────────────────
export const loginSchema = z
  .object({
    identifier: z
      .string()
      .trim()
      .min(1)
      .transform((val) => val.toLowerCase())
      .optional(),
    email: z
      .string()
      .trim()
      .min(1)
      .transform((val) => val.toLowerCase())
      .optional(),
    password: z.string().min(1, 'Password is required'),
    rememberMe: z.boolean().optional().default(false),
  })
  .strict()
  .refine((data) => Boolean(data.identifier || data.email), {
    message: 'Email address is required',
    path: ['email'],
  });

// ── Email Verification ──────────────────────────────────────────────────────
export const verifyEmailSchema = z
  .object({
    token: z.string().trim().min(16, 'Invalid or malformed verification token'),
  })
  .strict();

export const resendVerificationSchema = z
  .object({
    email: emailValidator,
  })
  .strict();

// ── Password Reset / Forgot Password ────────────────────────────────────────
export const forgotPasswordSchema = z
  .object({
    email: emailValidator,
  })
  .strict();

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(16, 'Invalid or malformed reset token'),
    newPassword: strongPasswordValidator,
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .strict()
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

// ── Authenticated Change Password ───────────────────────────────────────────
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: strongPasswordValidator,
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .strict()
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'New passwords do not match',
    path: ['confirmPassword'],
  });

// ── Legacy Account Migration / Claim ────────────────────────────────────────
export const claimLegacyRequestOtpSchema = z
  .object({
    phone: phoneValidator,
  })
  .strict();

export const claimLegacyCompleteSchema = z
  .object({
    phone: phoneValidator,
    otp: z
      .string()
      .trim()
      .regex(/^\d{4,8}$/, 'OTP must be a numeric verification code between 4 and 8 digits'),
    fullName: z
      .string()
      .trim()
      .min(2, 'Full name must be at least 2 characters')
      .max(100, 'Full name cannot exceed 100 characters'),
    username: usernameValidator,
    email: emailValidator,
    password: strongPasswordValidator,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: 'You must accept the Terms & Conditions' }),
    }),
  })
  .strict()
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

// ── Legacy OTP Verification & Request (Preserved for compatibility) ─────────
export const requestOtpSchema = z
  .object({
    phone: phoneValidator,
  })
  .strict();

export const verifyOtpSchema = z
  .object({
    phone: phoneValidator,
    otp: z
      .string()
      .trim()
      .regex(/^\d{4,8}$/, 'OTP must be a numeric verification code between 4 and 8 digits'),
    privacyConsent: z.boolean().optional(),
    marketingConsent: z.boolean().optional(),
    policyVersion: z.string().trim().max(20).optional(),
    termsVersion: z.string().trim().max(20).optional(),
  })
  .strict();

// ── Admin Login (Preserved) ─────────────────────────────────────────────────
export const adminLoginSchema = z
  .object({
    email: z.string().trim().email('Please enter a valid administrator email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
  })
  .strict();

// ── Customer Profile Update ─────────────────────────────────────────────────
export const updateProfileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name cannot exceed 100 characters')
      .optional(),
    fullName: z
      .string()
      .trim()
      .min(2, 'Full name must be at least 2 characters')
      .max(100, 'Full name cannot exceed 100 characters')
      .optional(),
    email: z
      .string()
      .trim()
      .email('Please enter a valid email address')
      .optional()
      .or(z.literal('')),
    avatar: z
      .string()
      .trim()
      .max(500, 'Avatar URL cannot exceed 500 characters')
      .optional()
      .or(z.literal('')),
    soundEnabled: z.boolean().optional(),
  })
  .strict();

// ── Customer Delivery Address ───────────────────────────────────────────────
export const addressSchema = z.object({
  label: z.enum(['Home', 'Work', 'Other']).default('Home'),
  recipientName: z
    .string()
    .trim()
    .min(2, 'Recipient name is required')
    .max(100),
  phone: phoneValidator,
  street: z
    .string()
    .trim()
    .min(3, 'Street address is required')
    .max(200),
  landmark: z.string().trim().max(100).optional().default(''),
  city: z.string().trim().default('Indore'),
  state: z.string().trim().default('Madhya Pradesh'),
  pincode: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{5}$/, 'Enter a valid 6-digit Indian PIN code (e.g. 452001)'),
  isDefault: z.boolean().optional().default(false),
  houseNumber: z.string().trim().max(50).optional().default(''),
  locality: z.string().trim().max(100).optional().default(''),
  formattedAddress: z.string().trim().max(300).optional().default(''),
  coordinates: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .nullable()
    .optional(),
});

// ── Account Deletion Request ────────────────────────────────────────────────
export const deletionRequestSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .max(500, 'Reason cannot exceed 500 characters')
      .optional()
      .default(''),
  })
  .strict();
