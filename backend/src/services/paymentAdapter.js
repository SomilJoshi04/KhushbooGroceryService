/**
 * Payment Gateway Adapter Service.
 *
 * Implements a unified interface for Cash on Delivery (COD) and Razorpay.
 * Features:
 * - Authoritative signature verification (HMAC-SHA256).
 * - Safe development simulation for testing environments.
 * - Fail-closed production security guard: online payments cannot be initialized
 *   with placeholder keys in production.
 *
 * @module services/paymentAdapter
 */

import crypto from 'node:crypto';
import { env } from '../config/env.js';

/**
 * Checks if production Razorpay credentials are valid and non-placeholder.
 * @returns {boolean}
 */
export function isRazorpayConfigured() {
  if (
    !env.RAZORPAY_KEY_ID ||
    env.RAZORPAY_KEY_ID.includes('placeholder') ||
    !env.RAZORPAY_KEY_SECRET ||
    env.RAZORPAY_KEY_SECRET.includes('placeholder')
  ) {
    return false;
  }
  return true;
}

/**
 * Creates an online payment intent/order on Razorpay.
 *
 * @param {Object} params
 * @param {string} params.orderId
 * @param {string} params.orderNumber
 * @param {number} params.amountPaise
 * @param {Object} params.customer
 * @returns {Promise<{providerOrderId: string, amountPaise: number, currency: string, keyId: string}>}
 */
export async function createPaymentOrder({ orderId, orderNumber, amountPaise, customer }) {
  const isProd = env.NODE_ENV === 'production';
  const configured = isRazorpayConfigured();

  // Fail-closed guard for production
  if (isProd && !configured) {
    throw new Error('Online payments are temporarily unavailable. Please choose Cash on Delivery.');
  }

  // Development simulation mode
  if (env.ALLOW_DEV_PAYMENT_SIMULATION || !configured) {
    const mockOrderId = `order_sim_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    return {
      provider: 'razorpay',
      providerOrderId: mockOrderId,
      amountPaise,
      currency: 'INR',
      keyId: env.RAZORPAY_KEY_ID || 'rzp_test_simulated',
      isSimulated: true,
    };
  }

  // Production / Real Razorpay REST call using Node native fetch (no bulky extra sdk required)
  const authHeader = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64');
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authHeader}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: 'INR',
      receipt: orderNumber,
      notes: {
        systemOrderId: orderId.toString(),
        customerPhone: customer.phone,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('[razorpay] Order creation failed:', errorBody);
    throw new Error('Failed to initiate online payment. Please try again.');
  }

  const razorpayOrder = await response.json();
  return {
    provider: 'razorpay',
    providerOrderId: razorpayOrder.id,
    amountPaise: razorpayOrder.amount,
    currency: razorpayOrder.currency,
    keyId: env.RAZORPAY_KEY_ID,
    isSimulated: false,
  };
}

/**
 * Cryptographically verifies the Razorpay payment signature.
 *
 * Formula: HMAC_SHA256(order_id + "|" + payment_id, secret) == signature
 *
 * @param {string} orderId
 * @param {string} paymentId
 * @param {string} signature
 * @returns {boolean}
 */
export function verifyPaymentSignature(orderId, paymentId, signature) {
  if (!orderId || !paymentId || !signature) {
    return false;
  }

  // Simulation check in non-production
  if (env.ALLOW_DEV_PAYMENT_SIMULATION && orderId.startsWith('order_sim_')) {
    const expectedSimulatedSig = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET || 'test_secret')
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    // Allow either the computed signature or 'SIMULATED_VALID_SIGNATURE' for dev convenience
    return signature === expectedSimulatedSig || signature === 'SIMULATED_VALID_SIGNATURE';
  }

  const secret = env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'utf-8'),
      Buffer.from(signature, 'utf-8')
    );
  } catch {
    return false;
  }
}

/**
 * Cryptographically verifies Razorpay webhook signatures against raw request body.
 *
 * @param {string|Buffer} rawBody
 * @param {string} webhookSignature
 * @returns {boolean}
 */
export function verifyWebhookSignature(rawBody, webhookSignature) {
  if (!rawBody || !webhookSignature) {
    return false;
  }

  const secret = env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'utf-8'),
      Buffer.from(webhookSignature, 'utf-8')
    );
  } catch {
    return false;
  }
}

/**
 * Processes a refund through Razorpay or local ledger.
 *
 * @param {Object} params
 * @param {string} params.paymentId
 * @param {number} params.amountPaise
 * @param {string} params.reason
 * @returns {Promise<{refundId: string, status: string}>}
 */
export async function processPaymentRefund({ paymentId, amountPaise, reason }) {
  if (env.ALLOW_DEV_PAYMENT_SIMULATION || !isRazorpayConfigured()) {
    const simulatedRefundId = `rfnd_sim_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    return {
      refundId: simulatedRefundId,
      status: 'PROCESSED',
      isSimulated: true,
    };
  }

  const authHeader = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64');
  const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authHeader}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: amountPaise,
      notes: { reason: reason || 'Customer requested refund' },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('[razorpay] Refund failed:', errorBody);
    throw new Error('Failed to process refund with payment provider.');
  }

  const data = await response.json();
  return {
    refundId: data.id,
    status: data.status === 'processed' ? 'PROCESSED' : 'PENDING',
    isSimulated: false,
  };
}
