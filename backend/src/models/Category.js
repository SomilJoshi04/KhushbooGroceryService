/**
 * Category Model — Grocery Product Categories.
 *
 * E.g., Atta & Flour, Besan, Masale, Daal & Pulses, Chawal, Oil & Ghee,
 * Sugar & Salt, Daily Essentials.
 *
 * @module models/Category
 */

import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      unique: true,
      trim: true,
      maxlength: [60, 'Category name cannot exceed 60 characters'],
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
      trim: true,
      default: '',
    },
    image: {
      type: String,
      default: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80',
    },
    order: {
      type: Number,
      default: 0,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

categorySchema.index({ isActive: 1, order: 1, name: 1 });

export const Category = mongoose.model('Category', categorySchema);
