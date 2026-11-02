/**
 * Product & Variant Models — Grocery items and purchasable variants.
 *
 * All financial amounts are stored in integer paise (₹1 = 100 paise)
 * to avoid floating-point inaccuracies.
 *
 * @module models/Product
 */

import mongoose from 'mongoose';

const variantSchema = new mongoose.Schema(
  {
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      unique: true,
      sparse: true,
      trim: true,
      uppercase: true,
    },
    label: {
      type: String,
      required: [true, 'Variant label is required (e.g., "1 kg", "5 kg")'],
      trim: true,
    },
    unit: {
      type: String,
      required: true,
      enum: ['kg', 'g', 'L', 'ml', 'pack', 'pcs'],
      default: 'kg',
    },
    quantity: {
      type: Number,
      required: true,
      min: [0.01, 'Quantity must be positive'],
    },
    // Selling price in integer paise (e.g. 24000 = ₹240.00)
    pricePaise: {
      type: Number,
      required: [true, 'Selling price in paise is required'],
      min: [100, 'Price must be at least ₹1.00 (100 paise)'],
      validate: {
        validator: Number.isInteger,
        message: 'pricePaise must be an integer',
      },
    },
    // MRP / Comparison price in integer paise (must be >= selling price)
    mrpPaise: {
      type: Number,
      required: [true, 'MRP in paise is required'],
      min: [100, 'MRP must be at least ₹1.00 (100 paise)'],
      validate: {
        validator: Number.isInteger,
        message: 'mrpPaise must be an integer',
      },
    },
    // Stock available for purchase
    stock: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Stock cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'stock must be an integer count',
      },
    },
    // Weight in grams (useful for shipping/delivery load calculations)
    weightGrams: {
      type: Number,
      required: true,
      default: 1000,
      min: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { _id: true, timestamps: true }
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [150, 'Product name cannot exceed 150 characters'],
      index: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Product category is required'],
      index: true,
    },
    brand: {
      type: String,
      trim: true,
      default: 'Khushboo Pure',
      index: true,
    },
    images: {
      type: [String],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'At least one product image is required',
      },
    },
    isVeg: {
      type: Boolean,
      default: true,
    },
    isPublished: {
      type: Boolean,
      default: true,
      index: true,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    variants: {
      type: [variantSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'Product must have at least one variant',
      },
    },
  },
  {
    timestamps: true,
  }
);

// Compound text index for fast keyword search on name, description, brand, tags
productSchema.index({
  name: 'text',
  description: 'text',
  brand: 'text',
  tags: 'text',
});

productSchema.index({ createdAt: -1, _id: -1 });
productSchema.index({ category: 1, createdAt: -1 });
productSchema.index({ isPublished: 1, createdAt: -1 });

export const Product = mongoose.model('Product', productSchema);
