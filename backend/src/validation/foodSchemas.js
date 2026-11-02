/**
 * Zod schemas for the food / product routes (interim, pre-grocery-model).
 *
 * These schemas define the ALLOWED fields for create/update operations.
 * Unknown fields are stripped (no mass assignment).
 *
 * NOTE: These are temporary schemas for the existing restaurant menu scaffold.
 * They will be replaced in P5 when proper grocery categories and variants
 * are implemented.
 *
 * @module validation/foodSchemas
 */

import { z } from 'zod';

/** Allowed category values for the existing model. */
const CATEGORIES = [
  'Thali',
  'Biryani',
  'Curry',
  'Breads',
  'Desserts',
  'Beverages',
  'Fast Food',
];

/**
 * Schema for creating a new food item.
 * Uses .strip() behaviour — Zod's default strips unknown keys.
 */
export const createFoodSchema = z.object({
  name: z
    .string({ required_error: 'name is required' })
    .trim()
    .min(2, 'name must be at least 2 characters')
    .max(120, 'name must be at most 120 characters'),

  description: z
    .string({ required_error: 'description is required' })
    .trim()
    .min(5, 'description must be at least 5 characters')
    .max(1000, 'description must be at most 1000 characters'),

  // Price in rupees (float allowed for now; will move to integer paise in P8).
  price: z
    .number({ required_error: 'price is required', invalid_type_error: 'price must be a number' })
    .positive('price must be positive')
    .max(100_000, 'price seems unrealistic'),

  category: z.enum(CATEGORIES, {
    errorMap: () => ({ message: `category must be one of: ${CATEGORIES.join(', ')}` }),
  }),

  image: z
    .string()
    .url('image must be a valid URL')
    .optional()
    .or(z.literal('')),

  isVeg: z.boolean().default(true),

  isAvailable: z.boolean().default(true),
  // Fields deliberately NOT accepted from clients:
  // rating — computed from real data, never client-supplied.
});

/**
 * Schema for partial update of a food item.
 * All fields optional; same constraints apply.
 */
export const updateFoodSchema = createFoodSchema.partial();
