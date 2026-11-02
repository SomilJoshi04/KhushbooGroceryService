/**
 * Banner Model — Promotional Hero & Campaign Banners.
 *
 * Implements:
 * - Internal name for administrative tracking.
 * - Customer-facing title, subtitle, promotional badge, and CTA action.
 * - Desktop and mobile responsive image URLs.
 * - Scheduling rules with start and end UTC timestamps.
 * - Display priority sorting for deterministic ordering.
 * - Granular active/inactive toggle.
 * - Audit tracking with createdBy and updatedBy administrator references.
 *
 * @module models/Banner
 */

import mongoose from 'mongoose';

const bannerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Internal banner name is required for admin identification'],
      trim: true,
      minlength: [2, 'Banner name must be at least 2 characters'],
      maxlength: [120, 'Banner name cannot exceed 120 characters'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Customer-facing promotional heading is required'],
      trim: true,
      minlength: [2, 'Promotional heading must be at least 2 characters'],
      maxlength: [150, 'Promotional heading cannot exceed 150 characters'],
    },
    subtitle: {
      type: String,
      required: [true, 'Supporting description is required'],
      trim: true,
      minlength: [2, 'Description must be at least 2 characters'],
      maxlength: [300, 'Description cannot exceed 300 characters'],
    },
    badge: {
      type: String,
      trim: true,
      maxlength: [50, 'Promotional badge cannot exceed 50 characters'],
      default: 'Special Offer',
    },
    desktopImage: {
      type: String,
      required: [true, 'Desktop banner image is required'],
      trim: true,
    },
    mobileImage: {
      type: String,
      trim: true,
      default: '',
    },
    buttonText: {
      type: String,
      trim: true,
      maxlength: [50, 'Button text cannot exceed 50 characters'],
      default: 'Shop Now',
    },
    buttonLink: {
      type: String,
      trim: true,
      maxlength: [250, 'Destination link cannot exceed 250 characters'],
      default: '/categories',
    },
    targetType: {
      type: String,
      enum: ['NONE', 'CATEGORY', 'PRODUCT', 'CUSTOM'],
      default: 'CATEGORY',
    },
    targetId: {
      type: String,
      trim: true,
      default: '',
    },
    priority: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Priority cannot be negative'],
      max: [10000, 'Priority cannot exceed 10000'],
      validate: {
        validator: Number.isInteger,
        message: 'Priority must be an integer',
      },
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    startDate: {
      type: Date,
      default: null,
      index: true,
    },
    endDate: {
      type: Date,
      default: null,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for optimal storefront query performance
bannerSchema.index({ isActive: 1, priority: -1, startDate: 1, endDate: 1 });
bannerSchema.index({ priority: 1, createdAt: -1, _id: -1 });
bannerSchema.index({ createdAt: -1, _id: -1 });

/**
 * Helper to determine if the banner is currently live and eligible for storefront display.
 * @returns {boolean}
 */
bannerSchema.methods.isEligible = function (atDate = new Date()) {
  if (!this.isActive) return false;
  if (this.startDate && this.startDate > atDate) return false;
  if (this.endDate && this.endDate <= atDate) return false;
  return true;
};

export const Banner = mongoose.model('Banner', bannerSchema);
