/**
 * Zod Validation Schemas for Payment Endpoints.
 *
 * @module validation/paymentSchemas
 */

import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createPaymentIntentSchema = z
  .object({
    orderId: z.string().regex(objectIdRegex, 'Invalid order ID format'),
  })
  .strict();

export const verifyPaymentSchema = z
  .object({
    orderId: z.string().regex(objectIdRegex, 'Invalid order ID format'),
    razorpayOrderId: z.string().min(5, 'razorpayOrderId must be at least 5 characters'),
    razorpayPaymentId: z.string().min(5, 'razorpayPaymentId must be at least 5 characters'),
    razorpaySignature: z.string().min(5, 'razorpaySignature must be at least 5 characters'),
  })
  .strict();

export const refundPaymentSchema = z
  .object({
    amountPaise: z.number().int().min(100).optional(),
    reason: z.string().max(300).optional(),
  })
  .strict();
