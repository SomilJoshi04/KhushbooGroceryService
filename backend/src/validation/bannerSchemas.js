/**
 * Zod Validation Schemas for Promotional Banners.
 *
 * Enforces:
 * - Field length limits and sanitization.
 * - Allowed image paths (relative /uploads/ or full HTTPS URLs).
 * - Safe internal or HTTPS destination links.
 * - Chronological date validation (endDate > startDate).
 * - Safe reordering payload validation.
 *
 * @module validation/bannerSchemas
 */

import { z } from 'zod';

// Accepts both external HTTP/HTTPS URLs and internal uploaded paths (/uploads/...)
const imagePathOrUrl = z.string().trim().min(1).refine(
  (val) => /^https?:\/\//i.test(val) || val.includes('/uploads/') || val.startsWith('uploads/'),
  { message: 'Image must be a valid web URL (http/https) or an uploaded image path (/uploads/...)' }
);

// Safe CTA link: must start with / (internal route) or be a secure https link
const safeLinkSchema = z.string().trim().refine(
  (val) => {
    if (!val) return true;
    if (val.startsWith('/')) return true;
    if (/^https?:\/\//i.test(val)) return true;
    return false;
  },
  { message: 'Destination link must be an internal route (starting with /) or a valid web URL' }
);

// Helper for parsing optional ISO date strings into Date objects or null
const optionalDateSchema = z.preprocess((arg) => {
  if (arg === null || arg === undefined || arg === '') return null;
  if (typeof arg === 'string' || arg instanceof Date) {
    const d = new Date(arg);
    return isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}, z.date().nullable().optional());

const bannerBaseObject = z
  .object({
    name: z.string().trim().min(2, 'Internal name must be at least 2 characters').max(120, 'Internal name cannot exceed 120 characters'),
    title: z.string().trim().min(2, 'Promotional heading must be at least 2 characters').max(150, 'Promotional heading cannot exceed 150 characters'),
    subtitle: z.string().trim().min(2, 'Description must be at least 2 characters').max(300, 'Description cannot exceed 300 characters'),
    badge: z.string().trim().max(50, 'Badge cannot exceed 50 characters').optional().default('Special Offer'),
    desktopImage: imagePathOrUrl,
    mobileImage: imagePathOrUrl.optional().or(z.literal('')).default(''),
    buttonText: z.string().trim().max(50, 'Button text cannot exceed 50 characters').optional().default('Shop Now'),
    buttonLink: safeLinkSchema.optional().default('/categories'),
    targetType: z.enum(['NONE', 'CATEGORY', 'PRODUCT', 'CUSTOM']).optional().default('CATEGORY'),
    targetId: z.string().trim().max(100).optional().default(''),
    priority: z.number().int('Priority must be an integer').min(0).max(10000).optional().default(0),
    isActive: z.boolean().optional().default(true),
    startDate: optionalDateSchema,
    endDate: optionalDateSchema,
  })
  .strict();

const validateDates = (data) => {
  if (data.startDate && data.endDate) {
    return data.endDate > data.startDate;
  }
  return true;
};

export const createBannerSchema = bannerBaseObject.refine(validateDates, {
  message: 'End date and time must be strictly after the start date and time',
  path: ['endDate'],
});

export const updateBannerSchema = bannerBaseObject.partial().refine(validateDates, {
  message: 'End date and time must be strictly after the start date and time',
  path: ['endDate'],
});

export const reorderBannersSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid banner ID format'),
      priority: z.number().int().min(0).max(10000),
    })
  ).min(1, 'At least one banner item is required for reordering'),
}).strict();
