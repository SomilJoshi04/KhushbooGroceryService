/**
 * DeliveryZone Model — Flexible Multi-City & Locality Delivery Zone Configuration.
 *
 * Supports:
 * - Unique uppercase zone code (e.g. IND-CENTRAL, IND-VIJAYNAGAR)
 * - Supported PIN codes and localities
 * - Geographic center coordinates and radius in kilometers
 * - Zone-specific delivery pricing rules (min order, free threshold, base fee, per-km tier)
 * - Active / Inactive / Temporarily Paused states with reason
 * - Configurable dispatch location reference
 * - Soft deletion to protect historical order records
 *
 * @module models/DeliveryZone
 */

import mongoose from 'mongoose';

const deliveryZoneSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Zone name is required'],
      trim: true,
      maxlength: [100, 'Zone name cannot exceed 100 characters'],
    },
    code: {
      type: String,
      required: [true, 'Zone code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
      match: [/^[A-Z0-9_-]{3,25}$/, 'Zone code must be 3-25 uppercase alphanumeric characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [300, 'Description cannot exceed 300 characters'],
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
      default: 'Indore',
      index: true,
    },
    state: {
      type: String,
      trim: true,
      default: 'Madhya Pradesh',
    },
    supportedPincodes: {
      type: [String],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0 && v.every((p) => /^\d{6}$/.test(p)),
        message: 'At least one valid 6-digit PIN code is required',
      },
      index: true,
    },
    boundaryType: {
      type: String,
      enum: ['RADIUS', 'POLYGON'],
      default: 'RADIUS',
    },
    center: {
      lat: {
        type: Number,
        required: true,
        min: [-90, 'Latitude must be between -90 and 90'],
        max: [90, 'Latitude must be between -90 and 90'],
      },
      lng: {
        type: Number,
        required: true,
        min: [-180, 'Longitude must be between -180 and 180'],
        max: [180, 'Longitude must be between -180 and 180'],
      },
    },
    radiusKm: {
      type: Number,
      required: true,
      min: [0.5, 'Radius must be at least 0.5 km'],
      max: [50, 'Radius cannot exceed 50 km'],
      default: 5.0,
    },
    dispatchLocation: {
      name: { type: String, default: 'Indore Central Hub' },
      address: { type: String, default: 'MG Road & Geeta Bhawan, Indore, MP 452001' },
      lat: { type: Number, default: 22.7196 },
      lng: { type: Number, default: 75.8577 },
    },
    // Zone Pricing Rules in integer paise
    minOrderAmountPaise: {
      type: Number,
      required: true,
      min: [0, 'Minimum order amount cannot be negative'],
      default: 15000, // ₹150
    },
    freeDeliveryThresholdPaise: {
      type: Number,
      required: true,
      min: [0, 'Free delivery threshold cannot be negative'],
      default: 49900, // ₹499
    },
    deliveryFeeBasePaise: {
      type: Number,
      required: true,
      min: [0, 'Delivery fee cannot be negative'],
      default: 2500, // ₹25
    },
    distanceTierPaisePerKm: {
      type: Number,
      default: 500, // ₹5 per extra km beyond base radius
      min: 0,
    },
    maxDeliveryDistanceKm: {
      type: Number,
      required: true,
      min: [1, 'Maximum delivery distance must be at least 1 km'],
      default: 15,
    },
    estimatedDeliveryWindow: {
      type: String,
      default: '90 - 120 Minutes',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isPaused: {
      type: Boolean,
      default: false,
      index: true,
    },
    pauseReason: {
      type: String,
      default: '',
      trim: true,
    },
    priority: {
      type: Number,
      default: 1, // Higher priority wins during deterministic overlap resolution
    },
    isDeleted: {
      type: Boolean,
      default: false,
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

deliveryZoneSchema.index({ city: 1, isActive: 1, isDeleted: 1 });
deliveryZoneSchema.index({ isDeleted: 1, createdAt: -1, _id: -1 });
deliveryZoneSchema.index({ isDeleted: 1, name: 1 });

export const DeliveryZone = mongoose.model('DeliveryZone', deliveryZoneSchema);
