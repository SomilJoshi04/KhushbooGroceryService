/**
 * HelpSupportSetting Model — Customer Help, Support Hours & Contact Configurations.
 *
 * @module models/HelpSupportSetting
 */

import mongoose from 'mongoose';

const supportTopicSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    icon: { type: String, default: 'HelpCircle' },
  },
  { _id: true }
);

const helpSupportSettingSchema = new mongoose.Schema(
  {
    verifiedPhone: {
      type: String,
      default: '+91 98260 12345',
      trim: true,
    },
    verifiedEmail: {
      type: String,
      default: 'support@khushboofood.com',
      trim: true,
    },
    businessHours: {
      type: String,
      default: 'Monday to Sunday: 7:00 AM – 10:00 PM',
      trim: true,
    },
    instructions: {
      type: String,
      default: 'Our doorstep grocery support team in Indore is ready to assist you. For queries regarding active orders, please provide your Order Number.',
      trim: true,
    },
    escalationPolicy: {
      type: String,
      default: 'Order delivery inquiries are prioritized and responded to within 15 minutes during operating hours.',
      trim: true,
    },
    supportTopics: [supportTopicSchema],
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

export const HelpSupportSetting = mongoose.model('HelpSupportSetting', helpSupportSettingSchema);
