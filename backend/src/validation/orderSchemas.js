/**
 * Zod validation schemas for Orders.
 *
 * @module validation/orderSchemas
 */

import { z } from 'zod';
import { phoneValidator } from './authSchemas.js';

export const orderItemInputSchema = z.object({
  productId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Product ObjectId'),
  sku: z.string().trim().min(3).max(40).toUpperCase(),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').max(50, 'Max 50 units per item'),
}).strict();

export const deliveryAddressInputSchema = z.object({
  recipientName: z.string().trim().min(2).max(100),
  phone: phoneValidator,
  street: z.string().trim().min(5).max(200),
  landmark: z.string().trim().max(100).optional().default(''),
  city: z.string().trim().default('Indore'),
  state: z.string().trim().default('Madhya Pradesh'),
  pincode: z.string().trim().regex(/^[1-9][0-9]{5}$/, 'Invalid 6-digit Indian PIN code'),
  coordinates: z
    .object({
      lat: z.number().finite('Latitude must be a finite number').min(-90).max(90),
      lng: z.number().finite('Longitude must be a finite number').min(-180).max(180),
    })
    .optional(),
}).strict();

export const createOrderSchema = z.object({
  items: z.array(orderItemInputSchema).min(1, 'At least one item is required to place an order'),
  deliveryAddress: deliveryAddressInputSchema,
  paymentMethod: z.enum(['COD', 'ONLINE']).default('COD'),
  idempotencyKey: z.string().trim().min(10).max(100).optional(),
}).strict();

export const cancelOrderSchema = z.object({
  reason: z.string().trim().min(5, 'Please provide a valid cancellation reason').max(300),
}).strict();

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    'PLACED',
    'CONFIRMED',
    'PROCESSING',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED',
  ]),
  note: z.string().trim().max(200).optional().default(''),
}).strict();
