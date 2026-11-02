/**
 * Zod validation schemas for Category and Product catalog.
 *
 * @module validation/catalogSchemas
 */

import { z } from 'zod';

// Accepts both external HTTP/HTTPS URLs and internal uploaded paths (/uploads/...)
const imagePathOrUrl = z.string().trim().min(1).refine(
  (val) => /^https?:\/\//i.test(val) || val.includes('/uploads/') || val.startsWith('uploads/'),
  { message: 'Image must be a valid web URL (http/https) or an uploaded image path (/uploads/...)' }
);

export const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(60),
  slug: z.string().trim().min(2).max(60).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().trim().max(500).optional().default(''),
  image: imagePathOrUrl.optional(),
  order: z.number().int().min(0).optional().default(0),
  isActive: z.boolean().optional().default(true),
}).strict();

export const updateCategorySchema = createCategorySchema.partial();

export const variantInputSchema = z.object({
  sku: z.string().trim().min(3).max(40).toUpperCase(),
  label: z.string().trim().min(1).max(50),
  unit: z.enum(['kg', 'g', 'L', 'ml', 'pack', 'pcs']),
  quantity: z.number().positive(),
  pricePaise: z.number().int().min(100, 'Price must be at least ₹1.00 (100 paise)'),
  mrpPaise: z.number().int().min(100, 'MRP must be at least ₹1.00 (100 paise)'),
  stock: z.number().int().min(0, 'Stock cannot be negative'),
  weightGrams: z.number().positive().optional().default(1000),
  isActive: z.boolean().optional().default(true),
}).refine((v) => v.mrpPaise >= v.pricePaise, {
  message: 'MRP must be greater than or equal to selling price',
  path: ['mrpPaise'],
});

export const createProductSchema = z.object({
  name: z.string().trim().min(3).max(150),
  slug: z.string().trim().min(3).max(150).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().trim().min(10).max(2000),
  category: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Category must be a valid MongoDB ObjectId'),
  brand: z.string().trim().max(60).optional().default('Khushboo Pure'),
  images: z.array(imagePathOrUrl).min(1, 'At least one image URL is required'),
  isVeg: z.boolean().optional().default(true),
  isPublished: z.boolean().optional().default(true),
  tags: z.array(z.string().trim()).optional().default([]),
  variants: z.array(variantInputSchema).min(1, 'At least one variant is required'),
}).strict();

export const updateProductSchema = createProductSchema.partial();

export const productQuerySchema = z.object({
  category: z.string().optional(),
  search: z.string().trim().optional(),
  minPrice: z.string().regex(/^\d+$/).transform(Number).optional(),
  maxPrice: z.string().regex(/^\d+$/).transform(Number).optional(),
  inStock: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  sort: z.enum(['price_asc', 'price_desc', 'newest', 'name_asc']).optional().default('newest'),
  page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
}).strict();
