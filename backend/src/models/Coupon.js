/**
 * Coupon Model — Promotional Discounts & Vouchers.
 *
 * All financial caps and minimums are stored in integer paise.
 *
 * @module models/Coupon
 */

import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Coupon code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      minlength: [3, 'Coupon code must be at least 3 characters'],
      maxlength: [20, 'Coupon code cannot exceed 20 characters'],
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    discountType: {
      type: String,
      enum: ['PERCENTAGE', 'FLAT'],
      required: true,
      default: 'PERCENTAGE',
    },
    // If PERCENTAGE: 10 = 10%. If FLAT: amount in paise (e.g. 5000 = ₹50)
    discountValue: {
      type: Number,
      required: true,
      min: [1, 'Discount value must be at least 1'],
    },
    minOrderAmountPaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxDiscountPaise: {
      type: Number,
      default: 0, // 0 = no cap
      min: 0,
    },
    usageLimit: {
      type: Number,
      default: 1000,
      min: 1,
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    // Applicability scope: ALL_PRODUCTS (entire store), CATEGORIES, or PRODUCTS
    applicability: {
      type: {
        type: String,
        enum: ['ALL_PRODUCTS', 'CATEGORIES', 'PRODUCTS'],
        default: 'ALL_PRODUCTS',
      },
      categoryIds: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Category',
        },
      ],
      productIds: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
        },
      ],
    },
  },
  {
    timestamps: true,
  }
);

couponSchema.index({ 'applicability.type': 1 });

couponSchema.methods.isValidForCart = function (subtotalPaise) {
  if (!this.isActive) return { valid: false, reason: 'This coupon is no longer active.' };
  if (this.expiresAt && new Date() > this.expiresAt) return { valid: false, reason: 'This coupon has expired.' };
  if (this.usageLimit && this.usedCount >= this.usageLimit) return { valid: false, reason: 'Coupon usage limit reached.' };
  if (this.minOrderAmountPaise && subtotalPaise < this.minOrderAmountPaise) {
    const minRupees = (this.minOrderAmountPaise / 100).toFixed(0);
    return { valid: false, reason: `Minimum order amount of ₹${minRupees} required to use this coupon.` };
  }

  let discountPaise = 0;
  if (this.discountType === 'PERCENTAGE') {
    discountPaise = Math.round((subtotalPaise * this.discountValue) / 100);
    if (this.maxDiscountPaise > 0 && discountPaise > this.maxDiscountPaise) {
      discountPaise = this.maxDiscountPaise;
    }
  } else {
    discountPaise = this.discountValue;
  }

  // Discount cannot exceed subtotal
  discountPaise = Math.min(discountPaise, subtotalPaise);

  return { valid: true, discountPaise };
};

couponSchema.index({ createdAt: -1, _id: -1 });
couponSchema.index({ isActive: 1, expiryDate: 1 });

export const Coupon = mongoose.model('Coupon', couponSchema);
