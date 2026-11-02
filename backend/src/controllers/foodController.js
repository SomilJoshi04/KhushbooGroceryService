/**
 * Food / product controller (interim scaffold).
 *
 * SECURITY NOTES:
 * - req.body is NEVER passed raw to Mongoose. Validated + stripped data
 *   arrives from the validate() middleware and explicit allowlists are used.
 * - The seed endpoint is DISABLED in production (NODE_ENV check).
 * - Fake/fallback sample data is returned ONLY in non-production when the DB
 *   has no items, so developers see something useful. Production NEVER returns
 *   fake ratings or fabricated data.
 *
 * @module controllers/foodController
 */

import { FoodItem } from '../models/FoodItem.js';
import { env } from '../config/env.js';

// ─────────────────────────────────────────────────────────────────────────────
// Development-only sample data (labeled clearly).
// Never used in production. Ratings are placeholders, not real averages.
// ─────────────────────────────────────────────────────────────────────────────
const DEV_SAMPLE_DISHES = [
  {
    name: '[DEV] Special Khushboo Thali',
    description: 'Development placeholder — add real items via POST /api/foods',
    price: 249,
    category: 'Thali',
    image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80',
    isVeg: true,
    isAvailable: true,
  },
  {
    name: '[DEV] Hyderabadi Dum Biryani',
    description: 'Development placeholder — add real items via POST /api/foods',
    price: 219,
    category: 'Biryani',
    image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80',
    isVeg: false,
    isAvailable: true,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Allowed fields for DB writes — explicit allowlist prevents mass assignment.
// ─────────────────────────────────────────────────────────────────────────────
const FOOD_ALLOWED_FIELDS = [
  'name',
  'description',
  'price',
  'category',
  'image',
  'isVeg',
  'isAvailable',
];

/**
 * Pick only allowed fields from a source object.
 * @param {Object} source
 * @returns {Object}
 */
function pickAllowed(source) {
  return FOOD_ALLOWED_FIELDS.reduce((acc, key) => {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      acc[key] = source[key];
    }
    return acc;
  }, {});
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/foods — list all food items
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return all active food items from the database.
 * In non-production, returns labeled development placeholders if the DB is empty.
 * In production, returns an empty array if no items exist (never fake data).
 */
export const getFoodItems = async (req, res, next) => {
  try {
    const items = await FoodItem.find().lean();

    if (items.length > 0) {
      return res.json({
        success: true,
        count: items.length,
        source: 'database',
        data: items,
      });
    }

    // Empty database response.
    if (env.NODE_ENV === 'production') {
      return res.json({
        success: true,
        count: 0,
        source: 'database',
        data: [],
      });
    }

    // Non-production: return clearly labeled dev placeholders so the UI renders.
    return res.json({
      success: true,
      count: DEV_SAMPLE_DISHES.length,
      source: 'dev_placeholder',
      message:
        'No items in DB. These are labeled development placeholders. ' +
        'POST to /api/foods or use /api/foods/seed (non-production only) to add real items.',
      data: DEV_SAMPLE_DISHES.map((item, i) => ({ ...item, _id: `dev-placeholder-${i + 1}` })),
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/foods — create a food item
// Body is pre-validated by validate(createFoodSchema) in routes.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a single food item.
 * Uses explicit field allowlist — req.body is NOT passed raw to Mongoose.
 */
export const createFoodItem = async (req, res, next) => {
  try {
    // req.body was already validated & stripped by the validate() middleware.
    // Use pickAllowed as a defence-in-depth guard anyway.
    const data = pickAllowed(req.body);

    const item = await FoodItem.create(data);

    res.status(201).json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/foods/seed — seed development data
// DISABLED in production. Guards in route AND here.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Seed a small set of labeled development items.
 *
 * SECURITY: This endpoint MUST be disabled or protected by authentication
 * before production deployment. Until admin auth is implemented (P4), it
 * is blocked by a NODE_ENV guard. Never run against the real Atlas database.
 */
export const seedFoodItems = async (req, res, next) => {
  // Double guard: route-level check + controller-level check.
  if (env.NODE_ENV === 'production') {
    const err = Object.assign(new Error('Not found'), { statusCode: 404 });
    return next(err);
  }

  try {
    // Clear existing and insert dev samples.
    await FoodItem.deleteMany({});
    const inserted = await FoodItem.insertMany(DEV_SAMPLE_DISHES);

    res.json({
      success: true,
      message: '[DEV ONLY] Seeded development food items successfully. Never run in production.',
      count: inserted.length,
      data: inserted,
    });
  } catch (err) {
    next(err);
  }
};
