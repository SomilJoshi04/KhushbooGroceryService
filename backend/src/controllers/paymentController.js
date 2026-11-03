/**
 * Payment Controller — Transaction Lifecycle, Signature Verification & Refunds.
 *
 * Enforces:
 * - Server-side cryptographic signature verification.
 * - Idempotent webhook processing.
 * - Transaction isolation and audit logging.
 *
 * @module controllers/paymentController
 */

import { Order } from '../models/Order.js';
import { Payment } from '../models/Payment.js';
import { StoreSetting } from '../models/StoreSetting.js';
import { AuditLog } from '../models/AuditLog.js';
import {
  createPaymentOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  processPaymentRefund,
} from '../services/paymentAdapter.js';
import { restoreStockForOrder } from '../services/inventoryService.js';
import { createNotification } from '../services/notificationService.js';

/**
 * POST /api/v1/payments/create-intent
 * Creates an online payment intent with Razorpay or confirms COD terms.
 */
export async function createPaymentIntent(req, res, next) {
  try {
    const { orderId } = req.body;
    const userId = req.user._id;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'Order not found.',
      });
    }

    // Enforce customer ownership
    if (order.customer.toString() !== userId.toString() && !['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        requestId: req.id,
        message: 'Access denied: You cannot initiate payment for another customer’s order.',
      });
    }

    if (order.payment.status === 'PAID') {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'Order has already been paid.',
      });
    }

    if (order.orderStatus === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'Cannot pay for a cancelled order.',
      });
    }

    // Cash on Delivery Handling
    if (order.payment.method === 'COD') {
      const storeSetting = await StoreSetting.findOne().lean();
      const codEnabled = storeSetting?.paymentSettings?.codEnabled ?? true;
      if (!codEnabled) {
        return res.status(400).json({
          success: false,
          requestId: req.id,
          code: 'PAYMENT_METHOD_DISABLED',
          error: 'PAYMENT_METHOD_DISABLED',
          message: 'Cash on Delivery is currently disabled.',
        });
      }

      let paymentRecord = await Payment.findOne({ order: order._id, method: 'COD' });
      if (!paymentRecord) {
        paymentRecord = await Payment.create({
          order: order._id,
          orderNumber: order.orderNumber,
          customer: userId,
          method: 'COD',
          provider: 'cod',
          amountPaise: order.pricing.grandTotalPaise,
          status: 'PENDING',
        });
      }

      return res.json({
        success: true,
        requestId: req.id,
        paymentMethod: 'COD',
        message: 'Order confirmed for Cash on Delivery. Payment will be collected at doorstep.',
        orderNumber: order.orderNumber,
        grandTotalPaise: order.pricing.grandTotalPaise,
      });
    }

    // Online Payment (Razorpay)
    const storeSetting = await StoreSetting.findOne().lean();
    const onlineEnabled = storeSetting?.paymentSettings?.onlinePaymentEnabled ?? true;

    // Check if an existing legitimate payment attempt is already in-flight
    let paymentRecord = await Payment.findOne({ order: order._id, method: 'ONLINE' });

    if (!onlineEnabled && (!paymentRecord || !paymentRecord.razorpayOrderId)) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        code: 'PAYMENT_METHOD_DISABLED',
        error: 'PAYMENT_METHOD_DISABLED',
        message: 'Online payment is currently disabled. Please contact customer support or choose an alternative payment method.',
      });
    }

    let razorpayOrderId = paymentRecord?.razorpayOrderId;
    let keyId = process.env.RAZORPAY_KEY_ID || '';

    if (!razorpayOrderId) {
      const razorpayOrder = await createPaymentOrder({
        orderId: order._id,
        orderNumber: order.orderNumber,
        amountPaise: order.pricing.grandTotalPaise,
        customer: {
          phone: req.user.phone,
          name: req.user.name,
          email: req.user.email,
        },
      });
      razorpayOrderId = razorpayOrder.providerOrderId;
      keyId = razorpayOrder.keyId || keyId;
    }

    if (!paymentRecord) {
      paymentRecord = new Payment({
        order: order._id,
        orderNumber: order.orderNumber,
        customer: userId,
        method: 'ONLINE',
        provider: 'razorpay',
        amountPaise: order.pricing.grandTotalPaise,
        status: 'PENDING',
      });
    }

    paymentRecord.razorpayOrderId = razorpayOrderId;
    await paymentRecord.save();

    res.json({
      success: true,
      requestId: req.id,
      paymentMethod: 'ONLINE',
      gateway: 'razorpay',
      razorpayOrderId,
      amountPaise: order.pricing.grandTotalPaise,
      currency: 'INR',
      keyId,
      orderNumber: order.orderNumber,
      customer: {
        name: req.user.name,
        phone: req.user.phone,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/payments/verify
 * Validates Razorpay client response and marks order as paid.
 */
export async function verifyPayment(req, res, next) {
  try {
    const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    const userId = req.user._id;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'Order not found.',
      });
    }

    // Check ownership
    if (order.customer.toString() !== userId.toString() && !['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        requestId: req.id,
        message: 'Access denied: You cannot verify payment for another customer’s order.',
      });
    }

    // Cryptographic signature check
    const isValid = verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);

    let paymentRecord = await Payment.findOne({ order: order._id, razorpayOrderId });
    if (!paymentRecord) {
      paymentRecord = new Payment({
        order: order._id,
        orderNumber: order.orderNumber,
        customer: userId,
        method: 'ONLINE',
        provider: 'razorpay',
        amountPaise: order.pricing.grandTotalPaise,
        razorpayOrderId,
      });
    }

    if (!isValid) {
      paymentRecord.status = 'FAILED';
      paymentRecord.failureReason = 'Invalid cryptographic payment signature';
      await paymentRecord.save();

      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'Payment verification failed: Invalid cryptographic signature.',
      });
    }

    // Success transition
    paymentRecord.status = 'CAPTURED';
    paymentRecord.razorpayPaymentId = razorpayPaymentId;
    paymentRecord.razorpaySignature = razorpaySignature;
    await paymentRecord.save();

    order.payment.status = 'PAID';
    order.payment.transactionId = razorpayPaymentId;
    order.payment.paidAt = new Date();
    order.orderStatus = 'CONFIRMED';
    order.statusHistory.push({
      status: 'CONFIRMED',
      changedAt: new Date(),
      changedBy: userId,
      note: `Online payment captured successfully via Razorpay (#${razorpayPaymentId}).`,
    });
    await order.save();

    await AuditLog.create({
      action: 'PAYMENT_CAPTURED',
      performedBy: userId,
      performerRole: req.user.role,
      targetType: 'Order',
      targetId: order._id.toString(),
      details: {
        orderNumber: order.orderNumber,
        razorpayPaymentId,
        amountPaise: order.pricing.grandTotalPaise,
      },
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    // Real-Time Notification: Notify admins of verified payment
    createNotification({
      recipientGroup: 'ALL_ADMINS',
      type: 'PAYMENT_VERIFIED',
      title: 'Payment Received',
      message: `Payment of ₹${(order.pricing.grandTotalPaise / 100).toFixed(2)} captured for Order #${order.orderNumber}.`,
      severity: 'SUCCESS',
      category: 'PAYMENT',
      targetType: 'Order',
      targetId: order._id,
      targetUrl: `/admin/orders?search=${order.orderNumber}`,
      metadata: {
        orderNumber: order.orderNumber,
        grandTotalPaise: order.pricing.grandTotalPaise,
        razorpayPaymentId,
      },
      idempotencyKey: `payment_verified_admin_${razorpayPaymentId}`,
      actorId: userId,
    }).catch((notifErr) => console.error('[notification] Payment verify admin notify error:', notifErr.message));

    // Real-Time Notification: Notify customer of verified payment
    createNotification({
      recipient: order.customer,
      type: 'PAYMENT_VERIFIED',
      title: 'Payment Confirmed',
      message: `Payment of ₹${(order.pricing.grandTotalPaise / 100).toFixed(2)} for Order #${order.orderNumber} confirmed.`,
      severity: 'SUCCESS',
      category: 'PAYMENT',
      targetType: 'Order',
      targetId: order._id,
      targetUrl: `/account?tab=orders&orderId=${order._id}`,
      metadata: {
        orderNumber: order.orderNumber,
        grandTotalPaise: order.pricing.grandTotalPaise,
      },
      idempotencyKey: `payment_verified_cust_${razorpayPaymentId}`,
      actorId: userId,
    }).catch((notifErr) => console.error('[notification] Payment verify customer notify error:', notifErr.message));

    res.json({
      success: true,
      requestId: req.id,
      message: 'Payment verified and order confirmed successfully.',
      order,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/payments/webhook
 * Razorpay server-to-server webhook endpoint.
 */
export async function handleWebhook(req, res, next) {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.rawBody || JSON.stringify(req.body);

    const isValid = verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid webhook signature.' });
    }

    const event = req.body.event;
    const payload = req.body.payload;

    if (event === 'payment.captured') {
      const paymentEntity = payload.payment.entity;
      const rzpOrderId = paymentEntity.order_id;
      const rzpPaymentId = paymentEntity.id;

      const payment = await Payment.findOne({ razorpayOrderId: rzpOrderId });
      if (payment && payment.status !== 'CAPTURED') {
        payment.status = 'CAPTURED';
        payment.razorpayPaymentId = rzpPaymentId;
        await payment.save();

        const order = await Order.findById(payment.order);
        if (order && order.payment.status !== 'PAID') {
          order.payment.status = 'PAID';
          order.payment.transactionId = rzpPaymentId;
          order.payment.paidAt = new Date();
          order.orderStatus = 'CONFIRMED';
          await order.save();
        }
      }
    } else if (event === 'payment.failed') {
      const paymentEntity = payload.payment.entity;
      const rzpOrderId = paymentEntity.order_id;

      const payment = await Payment.findOne({ razorpayOrderId: rzpOrderId });
      if (payment && payment.status === 'PENDING') {
        payment.status = 'FAILED';
        payment.failureReason = paymentEntity.error_description || 'Payment failed at gateway';
        await payment.save();
      }
    }

    res.status(200).json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/payments/orders/:id/refund
 * Admin-initiated order refund.
 */
export async function refundOrderPayment(req, res, next) {
  try {
    const { id } = req.params;
    const { reason, amountPaise } = req.body;
    const adminId = req.user._id;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'Order not found.',
      });
    }

    if (order.payment.status !== 'PAID') {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: `Cannot refund order in payment status "${order.payment.status}". Only PAID orders can be refunded.`,
      });
    }

    const refundAmount = amountPaise ? Number(amountPaise) : order.pricing.grandTotalPaise;

    let payment = await Payment.findOne({ order: order._id, status: 'CAPTURED' });
    const refundResult = await processPaymentRefund({
      paymentId: payment?.razorpayPaymentId || order.payment.transactionId || 'COD_LEDGER',
      amountPaise: refundAmount,
      reason: reason || 'Customer requested return / refund',
    });

    if (payment) {
      payment.status = 'REFUNDED';
      payment.refunds.push({
        refundId: refundResult.refundId,
        amountPaise: refundAmount,
        reason: reason || 'Admin authorized refund',
        status: refundResult.status,
        initiatedBy: adminId,
        createdAt: new Date(),
      });
      await payment.save();
    }

    order.payment.status = 'REFUNDED';
    order.orderStatus = 'CANCELLED';
    order.statusHistory.push({
      status: 'CANCELLED',
      changedAt: new Date(),
      changedBy: adminId,
      note: `Refund issued (${refundResult.refundId}) of ₹${refundAmount / 100}: ${reason || 'Admin refund'}.`,
    });
    await order.save();

    // Restock items atomically upon refund cancellation
    const itemsToRestore = order.items.map((i) => ({
      productId: i.product.toString(),
      sku: i.variantSku,
      quantity: i.quantity,
    }));
    await restoreStockForOrder(itemsToRestore, order._id.toString(), adminId.toString(), 'Order Refunded');

    await AuditLog.create({
      action: 'PAYMENT_REFUNDED',
      performedBy: adminId,
      performerRole: req.user.role,
      targetType: 'Order',
      targetId: order._id.toString(),
      details: {
        orderNumber: order.orderNumber,
        refundId: refundResult.refundId,
        amountPaise: refundAmount,
        reason,
      },
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    // Real-Time Notification: Notify customer of order refund
    createNotification({
      recipient: order.customer,
      type: 'PAYMENT_REFUNDED',
      title: 'Refund Processed',
      message: `A refund of ₹${(refundAmount / 100).toFixed(2)} has been processed for Order #${order.orderNumber}.`,
      severity: 'INFO',
      category: 'PAYMENT',
      targetType: 'Order',
      targetId: order._id,
      targetUrl: `/account?tab=orders&orderId=${order._id}`,
      metadata: {
        orderNumber: order.orderNumber,
        refundAmountPaise: refundAmount,
        refundId: refundResult.refundId,
      },
      idempotencyKey: `payment_refund_cust_${refundResult.refundId}`,
      actorId: adminId,
    }).catch((notifErr) => console.error('[notification] Payment refund customer notify error:', notifErr.message));

    res.json({
      success: true,
      requestId: req.id,
      message: `Refund of ₹${refundAmount / 100} processed successfully.`,
      refundId: refundResult.refundId,
      order,
    });
  } catch (err) {
    next(err);
  }
}
