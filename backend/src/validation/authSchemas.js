/**
 * Zod validation schemas for Authentication and User management.
 *
 * @module validation/authSchemas
 */

import { z } from 'zod';

/**
 * Normalizes an Indian phone number to '+91XXXXXXXXXX' format.
 * Accepts:
 * - 10 digits (e.g. '9876543210')
 * - 11 digits starting with 0 (e.g. '09876543210')
 * - 12 digits starting with 91 (e.g. '919876543210')
 * - 13 characters starting with +91 (e.g. '+919876543210')
 */
export const phoneValidator = z
  .string()
  .trim()
  .transform((val) => {
    // Strip all spaces, dashes, parentheses
    const cleaned = val.replace(/[\s\-()]/g, '');
    if (/^\+91[6-9]\d{9}$/.test(cleaned)) {
      return cleaned;
    }
    if (/^91[6-9]\d{9}$/.test(cleaned)) {
      return `+${cleaned}`;
    }
    if (/^0[6-9]\d{9}$/.test(cleaned)) {
      return `+91${cleaned.slice(1)}`;
    }
    if (/^[6-9]\d{9}$/.test(cleaned)) {
      return `+91${cleaned}`;
    }
    return cleaned;
  })
  .refine((val) => /^\+91[6-9]\d{9}$/.test(val), {
    message: 'Please provide a valid 10-digit Indian mobile number (e.g., 9826012345)',
  });

export const requestOtpSchema = z.object({
  phone: phoneValidator,
}).strict();

export const verifyOtpSchema = z.object({
  phone: phoneValidator,
  otp: z
    .string()
    .trim()
    .regex(/^\d{4,8}$/, 'OTP must be a numeric verification code between 4 and 8 digits'),
  privacyConsent: z.boolean().optional(),
  marketingConsent: z.boolean().optional(),
  policyVersion: z.string().trim().max(20).optional(),
  termsVersion: z.string().trim().max(20).optional(),
}).strict();

export const deletionRequestSchema = z.object({
  reason: z.string().trim().max(500, 'Reason cannot exceed 500 characters').optional().default(''),
}).strict();

export const adminLoginSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Please enter a valid administrator email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters'),
}).strict();

export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters')
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
}).strict();

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
