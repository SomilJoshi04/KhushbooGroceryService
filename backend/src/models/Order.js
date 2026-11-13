/**
 * Order Model — Complete Grocery Order.
 *
 * Implements:
 * - Immutable snapshots for items, address, and delivery pricing.
 * - Integer paise calculations for all financial totals.
 * - Idempotency key to prevent double checkout.
 * - Status transition history.
 *
 * @module models/Order
 */

import mongoose from 'mongoose';

const orderItemSnapshotSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    brand: {
      type: String,
      default: 'Khushboo Pure',
    },
    variantSku: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    variantLabel: {
      type: String,
      required: true,
    },
    unitPricePaise: {
      type: Number,
      required: true,
      min: 100,
    },
    mrpPaise: {
      type: Number,
      required: true,
      min: 100,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: 'Quantity must be an integer count',
      },
    },
    subtotalPaise: {
      type: Number,
      required: true,
      min: 100,
    },
    weightGrams: {
      type: Number,
      default: 1000,
    },
    image: {
      type: String,
      default: '',
    },
  },
  { _id: false }
);

const deliveryAddressSnapshotSchema = new mongoose.Schema(
  {
    recipientName: { type: String, required: true },
    phone: { type: String, required: true },
    street: { type: String, required: true },
    landmark: { type: String, default: '' },
    city: { type: String, default: 'Indore' },
    state: { type: String, default: 'Madhya Pradesh' },
    pincode: { type: String, required: true },
    coordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    items: {
      type: [orderItemSnapshotSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'Order must contain at least one item',
      },
    },
    // Server-calculated financial amounts in integer paise
    pricing: {
      itemsSubtotalPaise: { type: Number, required: true, min: 0 },
      savingsPaise: { type: Number, default: 0, min: 0 },
      deliveryFeePaise: { type: Number, required: true, min: 0 },
      discountPaise: { type: Number, default: 0, min: 0 },
      taxPaise: { type: Number, default: 0, min: 0 },
      grandTotalPaise: { type: Number, required: true, min: 0 },
    },
    deliveryAddress: {
      type: deliveryAddressSnapshotSchema,
      required: true,
    },
    deliverySnapshot: {
      zoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryZone', default: null },
      zoneCode: { type: String, default: '' },
      zoneName: { type: String, default: '' },
      distanceKm: { type: Number, default: 0 },
      matchedSlabLabel: { type: String, default: '' },
      isFreeDelivery: { type: Boolean, default: false },
      estimatedDeliveryWindow: { type: String, default: '90 - 120 Minutes' },
      pricingMode: { type: String, enum: ['STANDARD', 'DISTANCE_BASED'], default: 'STANDARD' },
      appliedDistanceRule: {
        fromKm: { type: Number },
        toKm: { type: Number },
        feePaise: { type: Number },
        label: { type: String },
      },
    },
    couponSnapshot: {
      code: { type: String, default: '' },
      couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', default: null },
      discountType: { type: String, enum: ['PERCENTAGE', 'FLAT', ''], default: '' },
      discountValue: { type: Number, default: 0 },
      discountPaise: { type: Number, default: 0 },
      eligibleSubtotalPaise: { type: Number, default: 0 },
      applicabilityType: { type: String, enum: ['ALL_PRODUCTS', 'CATEGORIES', 'PRODUCTS', ''], default: '' },
    },
    payment: {
      method: {
        type: String,
        enum: ['COD', 'ONLINE'],
        default: 'COD',
      },
      status: {
        type: String,
        enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'],
        default: 'PENDING',
        index: true,
      },
      transactionId: {
        type: String,
        default: '',
      },
      paidAt: {
        type: Date,
        default: null,
      },
    },
    orderStatus: {
      type: String,
      enum: [
        'PLACED',
        'CONFIRMED',
        'PROCESSING',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'CANCELLED',
      ],
      default: 'PLACED',
      index: true,
    },
    statusHistory: [
      {
        status: { type: String, required: true },
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        note: { type: String, default: '' },
      },
    ],
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    cancellationReason: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

orderSchema.index({ customer: 1, createdAt: -1, _id: -1 });
orderSchema.index({ orderStatus: 1, createdAt: -1, _id: -1 });
orderSchema.index({ createdAt: -1, _id: -1 });

export const Order = mongoose.model('Order', orderSchema);
