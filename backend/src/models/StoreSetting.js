/**
 * StoreSetting Model — Dynamic Storefront & Delivery Settings.
 *
 * Allows administrators to update operating hours, pause orders,
 * modify free-delivery thresholds, and adjust delivery zone parameters.
 *
 * @module models/StoreSetting
 */

import mongoose from 'mongoose';

const storeSettingSchema = new mongoose.Schema(
  {
    storeName: {
      type: String,
      default: 'Khushboo Grocery Service',
      trim: true,
    },
    tagline: {
      type: String,
      default: 'Indore’s Premier Fresh Grocery & Daily Essentials Store',
      trim: true,
    },
    contactPhone: {
      type: String,
      default: '+91 98260 12345',
      trim: true,
    },
    contactEmail: {
      type: String,
      default: 'support@khushboofood.com',
      trim: true,
    },
    address: {
      type: String,
      default: '123 MG Road, Geeta Bhawan, Indore, Madhya Pradesh 452001',
      trim: true,
    },
    serviceCity: {
      type: String,
      default: 'Indore',
      trim: true,
    },
    servicePincode: {
      type: String,
      default: '452001',
      trim: true,
    },
    dispatchCoordinates: {
      lat: { type: Number, default: 22.7196 },
      lng: { type: Number, default: 75.8577 },
    },
    isOpen: {
      type: Boolean,
      default: true,
    },
    announcementNotice: {
      type: String,
      default: 'Pure & Stone-Ground MP Sharbati Atta, Chana Besan, Cold-Pressed Oils, & Pure Cow Ghee delivered within 90-120 mins across Indore.',
      trim: true,
    },
    minOrderAmountPaise: {
      type: Number,
      default: 15000, // ₹150
      min: 0,
    },
    freeDeliveryThresholdPaise: {
      type: Number,
      default: 49900, // ₹499
      min: 0,
    },
    maxDeliveryDistanceKm: {
      type: Number,
      default: 15,
      min: 1,
    },
    deliveryFeeBasePaise: {
      type: Number,
      default: 2500, // ₹25
      min: 0,
    },
    estimatedDeliveryWindow: {
      type: String,
      default: '90 - 120 Minutes',
      trim: true,
    },
    distanceBasedPricing: {
      enabled: {
        type: Boolean,
        default: false,
      },
      rules: [
        {
          fromKm: { type: Number, required: true, min: 0 },
          toKm: { type: Number, required: true, min: 0.1 },
          feePaise: { type: Number, required: true, min: 0 },
          useStandardFee: { type: Boolean, default: false },
          label: { type: String, trim: true, default: '' },
        },
      ],
    },
    notificationSettings: {
      soundEnabled: {
        type: Boolean,
        default: true,
      },
      soundCooldownSeconds: {
        type: Number,
        default: 3,
        min: 1,
        max: 60,
      },
    },
    paymentSettings: {
      codEnabled: {
        type: Boolean,
        default: true,
      },
      onlinePaymentEnabled: {
        type: Boolean,
        default: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

export const StoreSetting = mongoose.model('StoreSetting', storeSettingSchema);
