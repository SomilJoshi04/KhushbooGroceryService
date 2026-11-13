/**
 * Authoritative Coupon Scope & Eligibility Calculation Service.
 *
 * Implements granular coupon evaluation against cart items:
 * - ALL_PRODUCTS: Applies across all eligible items in the cart.
 * - CATEGORIES: Applies only to items whose product category is in the coupon's categoryIds.
 * - PRODUCTS: Applies only to items whose productId is in the coupon's productIds.
 *
 * Strictly enforces:
 * - Integer paise arithmetic (no floats).
 * - Minimum order thresholds evaluated solely against eligible items subtotal.
 * - Caps discount to eligible items subtotal (no negative orders).
 * - Max discount cap enforcement for percentage discounts.
 * - Proportional item-level discount allocation without rounding loss.
 * - Atomic usage increment with race-condition prevention.
 *
 * @module services/couponService
 */

import mongoose from 'mongoose';
import { Coupon } from '../models/Coupon.js';
import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';

export const COUPON_SCOPES = {
  ALL_PRODUCTS: 'ALL_PRODUCTS',
  CATEGORIES: 'CATEGORIES',
  PRODUCTS: 'PRODUCTS',
};

export const COUPON_ERROR_CODES = {
  COUPON_NOT_FOUND: 'COUPON_NOT_FOUND',
  COUPON_INACTIVE: 'COUPON_INACTIVE',
  COUPON_EXPIRED: 'COUPON_EXPIRED',
  COUPON_LIMIT_REACHED: 'COUPON_LIMIT_REACHED',
  COUPON_ITEMS_REQUIRED: 'COUPON_ITEMS_REQUIRED',
  COUPON_NO_ELIGIBLE_ITEMS: 'COUPON_NO_ELIGIBLE_ITEMS',
  COUPON_MIN_ORDER_NOT_MET: 'COUPON_MIN_ORDER_NOT_MET',
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
};

/**
 * Validates applicability configuration from admin coupon forms.
 *
 * @param {Object} applicability
 * @returns {{ valid: boolean, sanitizedApplicability: Object, error?: string }}
 */
export async function validateCouponApplicabilityConfig(applicability = {}) {
  const type = applicability?.type || COUPON_SCOPES.ALL_PRODUCTS;

  if (!Object.values(COUPON_SCOPES).includes(type)) {
    return {
      valid: false,
      error: `Invalid applicability type. Must be one of: ${Object.values(COUPON_SCOPES).join(', ')}`,
    };
  }

  if (type === COUPON_SCOPES.ALL_PRODUCTS) {
    return {
      valid: true,
      sanitizedApplicability: {
        type: COUPON_SCOPES.ALL_PRODUCTS,
        categoryIds: [],
        productIds: [],
      },
    };
  }

  if (type === COUPON_SCOPES.CATEGORIES) {
    const rawIds = Array.isArray(applicability.categoryIds) ? applicability.categoryIds : [];
    const validIds = rawIds
      .map((id) => (typeof id === 'object' && id?._id ? id._id.toString() : id?.toString()))
      .filter((id) => mongoose.Types.ObjectId.isValid(id));

    if (validIds.length === 0) {
      return {
        valid: false,
        error: 'At least one valid category must be selected for category-scoped coupons.',
      };
    }

    // Verify categories exist in database
    const existingCount = await Category.countDocuments({
      _id: { $in: validIds.map((id) => new mongoose.Types.ObjectId(id)) },
    });

    if (existingCount !== validIds.length) {
      return {
        valid: false,
        error: 'One or more selected categories do not exist in the database.',
      };
    }

    return {
      valid: true,
      sanitizedApplicability: {
        type: COUPON_SCOPES.CATEGORIES,
        categoryIds: validIds.map((id) => new mongoose.Types.ObjectId(id)),
        productIds: [],
      },
    };
  }

  if (type === COUPON_SCOPES.PRODUCTS) {
    const rawIds = Array.isArray(applicability.productIds) ? applicability.productIds : [];
    const validIds = rawIds
      .map((id) => (typeof id === 'object' && id?._id ? id._id.toString() : id?.toString()))
      .filter((id) => mongoose.Types.ObjectId.isValid(id));

    if (validIds.length === 0) {
      return {
        valid: false,
        error: 'At least one valid product must be selected for product-scoped coupons.',
      };
    }

    // Verify products exist in database
    const existingCount = await Product.countDocuments({
      _id: { $in: validIds.map((id) => new mongoose.Types.ObjectId(id)) },
    });

    if (existingCount !== validIds.length) {
      return {
        valid: false,
        error: 'One or more selected products do not exist in the database.',
      };
    }

    return {
      valid: true,
      sanitizedApplicability: {
        type: COUPON_SCOPES.PRODUCTS,
        categoryIds: [],
        productIds: validIds.map((id) => new mongoose.Types.ObjectId(id)),
      },
    };
  }

  return { valid: false, error: 'Unknown coupon applicability configuration.' };
}

/**
 * Authoritatively validates a coupon and calculates discounts against cart items.
 *
 * @param {Object} options
 * @param {string} options.couponCode - The coupon code string.
 * @param {Array<Object>} [options.items] - Array of cart/order items [{ productId, sku, quantity, pricePaise }].
 * @param {number} [options.subtotalPaise] - Subtotal fallback when items are not provided.
 * @returns {Promise<Object>}
 */
export async function validateAndCalculateCouponDiscount({ couponCode, items = [], subtotalPaise = 0 }) {
  if (!couponCode || typeof couponCode !== 'string' || !couponCode.trim()) {
    return {
      valid: false,
      code: COUPON_ERROR_CODES.INVALID_PAYLOAD,
      message: 'Coupon code is required.',
    };
  }

  const normalizedCode = couponCode.trim().toUpperCase();
  const coupon = await Coupon.findOne({ code: normalizedCode });

  if (!coupon) {
    return {
      valid: false,
      code: COUPON_ERROR_CODES.COUPON_NOT_FOUND,
      message: `Coupon code "${normalizedCode}" is invalid.`,
    };
  }

  if (!coupon.isActive) {
    return {
      valid: false,
      code: COUPON_ERROR_CODES.COUPON_INACTIVE,
      message: 'This coupon is no longer active.',
    };
  }

  if (coupon.expiresAt && new Date() > new Date(coupon.expiresAt)) {
    return {
      valid: false,
      code: COUPON_ERROR_CODES.COUPON_EXPIRED,
      message: 'This coupon has expired.',
    };
  }

  if (coupon.usageLimit && coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
    return {
      valid: false,
      code: COUPON_ERROR_CODES.COUPON_LIMIT_REACHED,
      message: 'Coupon usage limit has been reached.',
    };
  }

  const applicabilityType = coupon.applicability?.type || COUPON_SCOPES.ALL_PRODUCTS;
  const couponCategoryIds = new Set(
    (coupon.applicability?.categoryIds || []).map((id) => id.toString())
  );
  const couponProductIds = new Set(
    (coupon.applicability?.productIds || []).map((id) => id.toString())
  );

  let eligibleSubtotalPaise = 0;
  let totalCartSubtotalPaise = 0;
  const evaluatedItems = [];

  const hasItemsArray = Array.isArray(items) && items.length > 0;

  if (hasItemsArray) {
    // Collect unique product ObjectIds
    const rawProductIds = items
      .map((i) => (typeof i.productId === 'object' && i.productId?._id ? i.productId._id.toString() : i.productId?.toString()))
      .filter((id) => mongoose.Types.ObjectId.isValid(id));

    const uniqueProductObjectIds = [...new Set(rawProductIds)].map(
      (id) => new mongoose.Types.ObjectId(id)
    );

    const productDocs = await Product.find({
      _id: { $in: uniqueProductObjectIds },
    })
      .select('_id name category variants isPublished')
      .lean();

    const productMap = new Map(productDocs.map((p) => [p._id.toString(), p]));

    for (const item of items) {
      const pIdStr = typeof item.productId === 'object' && item.productId?._id ? item.productId._id.toString() : item.productId?.toString();
      const product = productMap.get(pIdStr);
      const quantity = Math.max(1, Number(item.quantity || item.qty) || 1);

      // Resolve unit price authoritatively from product variant if available
      let unitPricePaise = Number(item.pricePaise) || 0;
      if (product && Array.isArray(product.variants) && item.sku) {
        const variant = product.variants.find((v) => v.sku === item.sku);
        if (variant && Number.isInteger(variant.pricePaise) && variant.pricePaise > 0) {
          unitPricePaise = variant.pricePaise;
        }
      }

      const lineTotalPaise = unitPricePaise * quantity;
      totalCartSubtotalPaise += lineTotalPaise;

      let isEligible = false;
      if (product) {
        if (applicabilityType === COUPON_SCOPES.ALL_PRODUCTS) {
          isEligible = true;
        } else if (applicabilityType === COUPON_SCOPES.CATEGORIES) {
          const catIdStr = product.category?.toString();
          isEligible = Boolean(catIdStr && couponCategoryIds.has(catIdStr));
        } else if (applicabilityType === COUPON_SCOPES.PRODUCTS) {
          isEligible = couponProductIds.has(product._id.toString());
        }
      }

      if (isEligible) {
        eligibleSubtotalPaise += lineTotalPaise;
      }

      evaluatedItems.push({
        productId: pIdStr,
        sku: item.sku,
        name: product?.name || item.name || 'Grocery Item',
        quantity,
        unitPricePaise,
        lineTotalPaise,
        isEligible,
      });
    }
  } else {
    // Fallback when only subtotal is provided (e.g., legacy or quick check)
    if (applicabilityType !== COUPON_SCOPES.ALL_PRODUCTS) {
      return {
        valid: false,
        code: COUPON_ERROR_CODES.COUPON_ITEMS_REQUIRED,
        message: 'Cart items are required to verify eligibility for scoped coupons.',
      };
    }
    eligibleSubtotalPaise = Math.max(0, Number(subtotalPaise) || 0);
    totalCartSubtotalPaise = eligibleSubtotalPaise;
  }

  // 1. Check if any items are eligible
  if (eligibleSubtotalPaise <= 0) {
    const scopeLabel =
      applicabilityType === COUPON_SCOPES.CATEGORIES
        ? 'selected categories'
        : applicabilityType === COUPON_SCOPES.PRODUCTS
        ? 'selected products'
        : 'qualifying products';

    return {
      valid: false,
      code: COUPON_ERROR_CODES.COUPON_NO_ELIGIBLE_ITEMS,
      message: `Your cart contains no items from the ${scopeLabel} eligible for coupon "${normalizedCode}".`,
      eligibleSubtotalPaise: 0,
      discountPaise: 0,
    };
  }

  // 2. Minimum Order Amount Check against eligible subtotal
  if (coupon.minOrderAmountPaise && eligibleSubtotalPaise < coupon.minOrderAmountPaise) {
    const minRupees = (coupon.minOrderAmountPaise / 100).toFixed(0);
    const eligibleRupees = (eligibleSubtotalPaise / 100).toFixed(0);
    return {
      valid: false,
      code: COUPON_ERROR_CODES.COUPON_MIN_ORDER_NOT_MET,
      message: `Minimum order amount of ₹${minRupees} on eligible items required. (Eligible items: ₹${eligibleRupees}).`,
      eligibleSubtotalPaise,
      discountPaise: 0,
    };
  }

  // 3. Calculate Discount Amount
  let discountPaise = 0;
  if (coupon.discountType === 'PERCENTAGE') {
    discountPaise = Math.round((eligibleSubtotalPaise * coupon.discountValue) / 100);
    if (coupon.maxDiscountPaise > 0 && discountPaise > coupon.maxDiscountPaise) {
      discountPaise = coupon.maxDiscountPaise;
    }
  } else {
    // FLAT discount
    discountPaise = coupon.discountValue;
  }

  // Cap discount so it never exceeds eligible subtotal
  discountPaise = Math.min(discountPaise, eligibleSubtotalPaise);
  discountPaise = Math.max(0, discountPaise);

  // 4. Proportional Item Discount Allocation
  const eligibleItems = evaluatedItems.filter((i) => i.isEligible);
  const itemDiscounts = [];

  if (eligibleItems.length > 0 && discountPaise > 0) {
    let allocatedTotal = 0;

    for (const item of eligibleItems) {
      const itemAllocated = Math.floor((item.lineTotalPaise / eligibleSubtotalPaise) * discountPaise);
      allocatedTotal += itemAllocated;
      itemDiscounts.push({
        productId: item.productId,
        sku: item.sku,
        allocatedDiscountPaise: itemAllocated,
      });
    }

    // Distribute remainder paise to largest lines
    let remainder = discountPaise - allocatedTotal;
    if (remainder > 0) {
      const sortedByLine = [...itemDiscounts].sort((a, b) => {
        const itemA = eligibleItems.find((i) => i.sku === a.sku)?.lineTotalPaise || 0;
        const itemB = eligibleItems.find((i) => i.sku === b.sku)?.lineTotalPaise || 0;
        return itemB - itemA;
      });

      let idx = 0;
      while (remainder > 0 && idx < sortedByLine.length) {
        sortedByLine[idx].allocatedDiscountPaise += 1;
        remainder -= 1;
        idx = (idx + 1) % sortedByLine.length;
      }
    }
  }

  return {
    valid: true,
    code: coupon.code,
    couponId: coupon._id,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    discountPaise,
    discountRupees: (discountPaise / 100).toFixed(0),
    eligibleSubtotalPaise,
    eligibleSubtotalRupees: (eligibleSubtotalPaise / 100).toFixed(0),
    totalCartSubtotalPaise,
    applicabilityType,
    description: coupon.description,
    eligibleItemCount: eligibleItems.length,
    itemDiscounts,
    couponDoc: coupon,
  };
}

/**
 * Atomically increments coupon usage count while strictly respecting usageLimit.
 * Prevents race condition overselling across concurrent checkout requests.
 *
 * @param {string|mongoose.Types.ObjectId} couponId
 * @returns {Promise<boolean>} - True if claimed successfully, false if limit reached.
 */
export async function claimCouponUsageAtomic(couponId) {
  if (!couponId) return false;

  const result = await Coupon.findOneAndUpdate(
    {
      _id: couponId,
      isActive: true,
      $or: [
        { usageLimit: { $exists: false } },
        { usageLimit: null },
        { usageLimit: 0 },
        { $expr: { $lt: ['$usedCount', '$usageLimit'] } },
      ],
    },
    { $inc: { usedCount: 1 } },
    { new: true }
  );

  return Boolean(result);
}

/**
 * Atomically decrements coupon usage count on order cancellation or checkout rollback.
 *
 * @param {string|mongoose.Types.ObjectId} couponId
 * @returns {Promise<void>}
 */
export async function releaseCouponUsageAtomic(couponId) {
  if (!couponId) return;
  await Coupon.findByIdAndUpdate(couponId, {
    $inc: { usedCount: -1 },
  });
}

