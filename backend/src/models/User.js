/**
 * User Model — handles both Customers and Administrators.
 *
 * Roles:
 * - CUSTOMER: standard consumer purchasing groceries (authenticated via phone OTP).
 * - STAFF: view-only or restricted order processing.
 * - ADMIN: full operational dashboard access.
 * - SUPER_ADMIN: complete access including administrative user management.
 *
 * @module models/User
 */

import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      enum: ['Home', 'Work', 'Other'],
      default: 'Home',
    },
    recipientName: {
      type: String,
      required: [true, 'Recipient name is required'],
      trim: true,
      maxlength: [100, 'Recipient name cannot exceed 100 characters'],
    },
    phone: {
      type: String,
      required: [true, 'Contact phone number is required'],
      trim: true,
    },
    street: {
      type: String,
      required: [true, 'Street address / House number is required'],
      trim: true,
      maxlength: [200, 'Street address cannot exceed 200 characters'],
    },
    landmark: {
      type: String,
      trim: true,
      maxlength: [100, 'Landmark cannot exceed 100 characters'],
      default: '',
    },
    city: {
      type: String,
      required: true,
      trim: true,
      default: 'Indore',
    },
    state: {
      type: String,
      trim: true,
      default: 'Madhya Pradesh',
    },
    pincode: {
      type: String,
      required: [true, 'Pincode is required'],
      trim: true,
      match: [/^[1-9][0-9]{5}$/, 'Please enter a valid 6-digit Indian PIN code'],
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    houseNumber: {
      type: String,
      trim: true,
      default: '',
    },
    locality: {
      type: String,
      trim: true,
      default: '',
    },
    formattedAddress: {
      type: String,
      trim: true,
      default: '',
    },
    coordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },
    zoneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeliveryZone',
      default: null,
    },
    geocodingProvider: {
      type: String,
      default: 'nominatim',
    },
    placeId: {
      type: String,
      default: '',
    },
  },
  { _id: true, timestamps: true }
);

const userSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
      index: true,
      validate: {
        validator: function (v) {
          if (this?.isDeleted || (typeof v === 'string' && (v.startsWith('ANON_') || v.startsWith('+9100000')))) {
            return true;
          }
          return /^\+91[6-9]\d{9}$/.test(v);
        },
        message: 'Please enter a valid Indian mobile number (+91XXXXXXXXXX)',
      },
    },
    name: {
      type: String,
      trim: true,
      default: 'Grocery Customer',
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      index: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address'],
    },
    avatar: {
      type: String,
      trim: true,
      default: '',
    },
    role: {
      type: String,
      enum: ['CUSTOMER', 'STAFF', 'ADMIN', 'SUPER_ADMIN'],
      default: 'CUSTOMER',
      index: true,
    },
    // Used strictly for Admin/Staff portal credentials. Customers authenticate via Phone OTP.
    password: {
      type: String,
      select: false,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    // Security & session invalidation counter
    sessionVersion: {
      type: Number,
      default: 1,
    },
    // Suspension metadata
    suspendedAt: {
      type: Date,
      default: null,
    },
    suspendedReason: {
      type: String,
      default: '',
    },
    suspendedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // Controlled deletion / anonymization metadata
    anonymizedAt: {
      type: Date,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    // Personal notification sound preference (defaults to true; can opt-out individually)
    soundEnabled: {
      type: Boolean,
      default: true,
    },
    addresses: [addressSchema],
    cart: [
      new mongoose.Schema(
        {
          cartKey: { type: String, required: true },
          productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
          variantId: { type: String, default: '' },
          variantSku: { type: String, default: '' },
          variantLabel: { type: String, default: '' },
          name: { type: String, required: true },
          brand: { type: String, default: 'Khushboo Pure' },
          image: { type: String, default: '' },
          pricePaise: { type: Number, required: true, default: 0 },
          mrpPaise: { type: Number, default: 0 },
          weightGrams: { type: Number, default: 0 },
          stock: { type: Number, default: 0 },
          qty: { type: Number, required: true, min: 1, default: 1 },
        },
        { _id: true, timestamps: true }
      ),
    ],
    privacyConsent: {
      agreed: { type: Boolean, default: false },
      agreedAt: { type: Date, default: null },
      policyVersion: { type: String, default: '1.0' },
      termsVersion: { type: String, default: '1.0' },
      ipAddress: { type: String, default: '' },
      userAgent: { type: String, default: '' },
    },
    marketingConsent: {
      agreed: { type: Boolean, default: false },
      agreedAt: { type: Date, default: null },
    },
    deletionRequest: {
      requested: { type: Boolean, default: false, index: true },
      requestedAt: { type: Date, default: null },
      reason: { type: String, default: '' },
      status: {
        type: String,
        enum: ['NONE', 'PENDING', 'APPROVED', 'REJECTED'],
        default: 'NONE',
      },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      reviewedAt: { type: Date, default: null },
      adminNotes: { type: String, default: '' },
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Method to return safe JSON without sensitive fields
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};

userSchema.index({ role: 1, isActive: 1, isDeleted: 1, createdAt: -1, _id: -1 });
userSchema.index({ role: 1, createdAt: -1, _id: -1 });

export const User = mongoose.model('User', userSchema);
