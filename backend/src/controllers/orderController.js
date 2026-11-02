/**
 * Order Controller — Purchase, History, Cancellation, and Integrity.
 *
 * Enforces:
 * - Server-side price calculation (never trusts client prices or fees).
 * - Atomic stock deduction with rollback on depletion.
 * - Idempotency handling against duplicate requests.
 * - Strict customer data isolation (customers only access their own orders).
 *
 * @module controllers/orderController
 */

import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { Coupon } from '../models/Coupon.js';
import { StoreSetting } from '../models/StoreSetting.js';
import { calculateDeliveryPricing, getEffectiveMinOrderAmountPaise } from '../services/deliveryService.js';
import { deductStockForOrder, restoreStockForOrder } from '../services/inventoryService.js';
import { AuditLog } from '../models/AuditLog.js';
import { createNotification } from '../services/notificationService.js';
import { env } from '../config/env.js';

/**
 * Generates a human-readable unique order number.
 * E.g., ORD-IND-20261028-4821
 */
function generateOrderNumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `ORD-IND-${dateStr}-${rand}`;
}

/**
 * POST /api/v1/orders
 * Creates an order, verifies prices, calculates delivery, and deducts stock atomically.
 */
export async function createOrder(req, res, next) {
  try {
    const { items, deliveryAddress, paymentMethod, idempotencyKey, couponCode } = req.body;
    const userId = req.user._id;

    // Prevent administrative accounts from placing customer grocery orders
    if (req.user && ['ADMIN', 'SUPER_ADMIN', 'STAFF'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        requestId: req.id,
        code: 'ADMIN_ORDER_CREATION_FORBIDDEN',
        message: 'Administrative accounts cannot place grocery orders. Live store preview is read-only for shopping and orders.',
      });
    }

    // 1. Check idempotency: if order already exists with this key, return it safely
    if (idempotencyKey) {
      const existingOrder = await Order.findOne({ idempotencyKey });
      if (existingOrder) {
        return res.status(200).json({
          success: true,
          requestId: req.id,
          message: 'Order retrieved from existing submission (idempotent request).',
          order: existingOrder,
        });
      }
    }

    // 1b. Server-Side Payment Availability Enforcement
    const requestedMethod = (paymentMethod || 'COD').toUpperCase();
    const storeSetting = await StoreSetting.findOne().lean();
    const codEnabled = storeSetting?.paymentSettings?.codEnabled ?? true;
    const onlineEnabled = storeSetting?.paymentSettings?.onlinePaymentEnabled ?? true;

    if (!codEnabled && !onlineEnabled) {
      return res.status(503).json({
        success: false,
        requestId: req.id,
        code: 'CHECKOUT_TEMPORARILY_UNAVAILABLE',
        error: 'CHECKOUT_TEMPORARILY_UNAVAILABLE',
        message: 'Checkout is temporarily unavailable because payment methods are currently suspended by store administration.',
      });
    }

    if (requestedMethod === 'COD' && !codEnabled) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        code: 'PAYMENT_METHOD_DISABLED',
        error: 'PAYMENT_METHOD_DISABLED',
        message: 'Cash on Delivery (COD) is currently disabled. Please select an available payment method.',
      });
    }

    if ((requestedMethod === 'ONLINE' || requestedMethod === 'RAZORPAY') && !onlineEnabled) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        code: 'PAYMENT_METHOD_DISABLED',
        error: 'PAYMENT_METHOD_DISABLED',
        message: 'Online payment is currently disabled. Please select an available payment method.',
      });
    }

    // 2. Authoritative Server-Side Item Validation & Snapshot
    const itemSnapshots = [];
    let itemsSubtotalPaise = 0;
    let savingsPaise = 0;

    for (const itemInput of items) {
      const product = await Product.findById(itemInput.productId);
      if (!product || !product.isPublished) {
        return res.status(400).json({
          success: false,
          requestId: req.id,
          message: `Product "${itemInput.productId}" is currently unavailable.`,
        });
      }

      const variant = product.variants.find((v) => v.sku === itemInput.sku);
      if (!variant || !variant.isActive) {
        return res.status(400).json({
          success: false,
          requestId: req.id,
          message: `Pack size "${itemInput.sku}" for ${product.name} is currently unavailable.`,
        });
      }

      const qty = Number(itemInput.quantity);
      const subtotal = variant.pricePaise * qty;
      const mrpSubtotal = variant.mrpPaise * qty;

      itemsSubtotalPaise += subtotal;
      savingsPaise += Math.max(0, mrpSubtotal - subtotal);

      itemSnapshots.push({
        product: product._id,
        productName: product.name,
        brand: product.brand,
        variantSku: variant.sku,
        variantLabel: variant.label,
        unitPricePaise: variant.pricePaise,
        mrpPaise: variant.mrpPaise,
        quantity: qty,
        subtotalPaise: subtotal,
        weightGrams: variant.weightGrams,
        image: product.images?.[0] || '',
      });
    }

    // 3. Server-Side Authoritative Delivery Pricing (Calculates Zone, Distance, and Serviceability)
    const deliveryCalc = await calculateDeliveryPricing({
      pincode: deliveryAddress.pincode,
      city: deliveryAddress.city,
      coordinates: deliveryAddress.coordinates,
      subtotalPaise: itemsSubtotalPaise,
    });

    if (!deliveryCalc.isServiceable) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: deliveryCalc.reason || 'Address is outside our Indore delivery zone.',
      });
    }

    if (deliveryCalc.isPaused) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: `Delivery in ${deliveryCalc.zone?.name || 'this zone'} is temporarily suspended: ${deliveryCalc.pauseReason || 'Maintenance'}.`,
      });
    }

    // 4. Dynamic Minimum Order Amount Check (Prioritizes Zone / Admin Settings from DB)
    let effectiveMinOrderPaise = deliveryCalc.minOrderAmountPaise;
    if (effectiveMinOrderPaise === undefined || effectiveMinOrderPaise === null) {
      effectiveMinOrderPaise = await getEffectiveMinOrderAmountPaise(deliveryCalc.zone);
    }
    if (itemsSubtotalPaise < effectiveMinOrderPaise) {
      const minRupees = effectiveMinOrderPaise / 100;
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: `Minimum order amount for delivery is ₹${minRupees.toFixed(0)}. Your subtotal is ₹${(itemsSubtotalPaise / 100).toFixed(0)}.`,
      });
    }

    const deliveryFeePaise = deliveryCalc.deliveryFeePaise;
    let discountPaise = 0;
    let appliedCouponDoc = null;

    if (couponCode && typeof couponCode === 'string') {
      appliedCouponDoc = await Coupon.findOne({ code: couponCode.toUpperCase().trim() });
      if (appliedCouponDoc) {
        const check = appliedCouponDoc.isValidForCart(itemsSubtotalPaise);
        if (check.valid) {
          discountPaise = check.discountPaise;
        }
      }
    }

    const grandTotalPaise = Math.max(0, itemsSubtotalPaise + deliveryFeePaise - discountPaise);

    const orderNumber = generateOrderNumber();

    // 5. Create Order Document in Database
    const order = new Order({
      orderNumber,
      customer: userId,
      items: itemSnapshots,
      pricing: {
        itemsSubtotalPaise,
        savingsPaise,
        deliveryFeePaise,
        discountPaise,
        taxPaise: 0, // 0% GST on basic staples
        grandTotalPaise,
      },
      deliveryAddress,
      deliverySnapshot: {
        zoneId: deliveryCalc.zone?.id || null,
        zoneCode: deliveryCalc.zone?.code || '',
        zoneName: deliveryCalc.zone?.name || '',
        distanceKm: deliveryCalc.distanceKm,
        matchedSlabLabel: `${deliveryCalc.distanceKm} km (${deliveryCalc.zone?.name || 'Indore'})`,
        isFreeDelivery: deliveryCalc.isFreeDelivery,
        estimatedDeliveryWindow: deliveryCalc.estimatedDeliveryWindow || '90 - 120 Minutes',
      },
      payment: {
        method: paymentMethod || 'COD',
        status: 'PENDING',
      },
      orderStatus: 'PLACED',
      statusHistory: [
        {
          status: 'PLACED',
          changedAt: new Date(),
          changedBy: userId,
          note: `Order placed via ${paymentMethod || 'COD'}.`,
        },
      ],
      idempotencyKey: idempotencyKey || undefined,
    });

    // 6. Atomically Deduct Stock (Phase 4)
    // If stock deduction throws InsufficientStockError, it automatically rolls back
    try {
      await deductStockForOrder(items, order._id.toString(), userId.toString());
    } catch (stockErr) {
      return res.status(stockErr.statusCode || 409).json({
        success: false,
        requestId: req.id,
        message: stockErr.message,
      });
    }

    // Save final order
    await order.save();

    if (appliedCouponDoc) {
      await Coupon.findByIdAndUpdate(appliedCouponDoc._id, { $inc: { usedCount: 1 } });
    }

    // Real-Time Notification: Notify administrators of newly placed order
    createNotification({
      recipientId: null,
      recipientRole: 'ALL_ADMINS',
      type: 'ORDER_CREATED',
      title: 'New Order Received',
      message: `Order #${order.orderNumber} placed for ₹${(order.pricing.grandTotalPaise / 100).toFixed(2)}.`,
      category: 'ORDER',
      entityType: 'Order',
      entityId: order._id.toString(),
      actionUrl: `/admin/orders?search=${order.orderNumber}`,
      metadata: { orderNumber: order.orderNumber },
      idempotencyKey: `order_created_admin_${order._id}`,
    }).catch((notifErr) => console.error('[notification] Order creation admin notify error:', notifErr.message));

    // Real-Time Notification: Notify customer of order placement
    createNotification({
      recipientId: userId,
      recipientRole: 'CUSTOMER',
      type: 'ORDER_CREATED',
      title: 'Order Placed',
      message: `Your grocery order #${order.orderNumber} has been placed successfully and is awaiting store confirmation.`,
      category: 'ORDER',
      entityType: 'Order',
      entityId: order._id.toString(),
      actionUrl: `/account?tab=orders&orderId=${order._id}`,
      metadata: { orderNumber: order.orderNumber, status: 'PLACED' },
      idempotencyKey: `order_created_cust_${order._id}`,
    }).catch((notifErr) => console.error('[notification] Order creation customer notify error:', notifErr.message));

    res.status(201).json({
      success: true,
      requestId: req.id,
      message: 'Order placed successfully.',
      order,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/orders
 * Returns paginated orders placed by the currently authenticated customer.
 * Default: 6 orders per page. Single source of truth is MongoDB.
 */
export async function getMyOrders(req, res, next) {
  try {
    const DEFAULT_PAGE = 1;
    const DEFAULT_LIMIT = 6;
    const MAX_LIMIT = 50;

    const rawPage = parseInt(req.query.page, 10);
    const rawLimit = parseInt(req.query.limit, 10);

    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : DEFAULT_PAGE;
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT;

    const filter = { customer: req.user._id };

    const { status } = req.query;
    if (status && status !== 'ALL' && typeof status === 'string') {
      const allowedStatuses = ['PLACED', 'CONFIRMED', 'PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
      if (allowedStatuses.includes(status)) {
        filter.orderStatus = status;
      }
    }

    const totalOrders = await Order.countDocuments(filter);
    const totalPages = totalOrders > 0 ? Math.ceil(totalOrders / limit) : 0;
    const skip = (page - 1) * limit;

    const orders = totalOrders > 0 && skip < totalOrders
      ? await Order.find(filter)
          .sort({ createdAt: -1, _id: -1 })
          .skip(skip)
          .limit(limit)
          .lean()
      : [];

    const pagination = {
      currentPage: page,
      pageSize: limit,
      totalOrders,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1 && totalPages > 0 && page <= totalPages + 1,
      nextPage: page < totalPages ? page + 1 : null,
      previousPage: page > 1 ? (totalPages > 0 ? Math.min(page - 1, totalPages) : null) : null,
    };

    res.json({
      success: true,
      requestId: req.id,
      data: {
        orders,
        pagination,
      },
      count: orders.length,
      total: totalOrders,
      page,
      totalPages,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/orders/:id
 * Retrieves order detail. Strictly enforces ownership.
 */
export async function getOrderById(req, res, next) {
  try {
    const { id } = req.params;

    const order = await Order.findById(id).lean();
    if (!order) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'Order not found.',
      });
    }

    // Security Guard: Customer can ONLY access their own order
    const isOwner = order.customer.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        requestId: req.id,
        message: 'Access denied: You do not have permission to view this order.',
      });
    }

    res.json({
      success: true,
      requestId: req.id,
      data: order,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/orders/:id/cancel
 * Customer order cancellation with atomic stock release.
 */
export async function cancelOrder(req, res, next) {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'Order not found.',
      });
    }

    // Enforce ownership
    const isOwner = order.customer.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        requestId: req.id,
        message: 'Access denied: You cannot cancel another customer’s order.',
      });
    }

    // Only permits cancellation in PLACED or CONFIRMED state
    if (order.orderStatus !== 'PLACED' && order.orderStatus !== 'CONFIRMED') {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: `Order cannot be cancelled in "${order.orderStatus}" status. Please contact support.`,
      });
    }

    // Atomically restore stock for all items
    const itemsToRestore = order.items.map((i) => ({
      productId: i.product.toString(),
      sku: i.variantSku,
      quantity: i.quantity,
    }));

    await restoreStockForOrder(
      itemsToRestore,
      order._id.toString(),
      req.user._id.toString(),
      reason || 'Customer requested cancellation'
    );

    order.orderStatus = 'CANCELLED';
    order.cancellationReason = reason || 'Customer requested cancellation';
    order.statusHistory.push({
      status: 'CANCELLED',
      changedAt: new Date(),
      changedBy: req.user._id,
      note: reason || 'Order cancelled',
    });

    await order.save();

    await AuditLog.create({
      action: 'ORDER_CANCELLED',
      performedBy: req.user._id,
      performerRole: req.user.role,
      targetType: 'Order',
      targetId: order._id.toString(),
      details: { orderNumber: order.orderNumber, reason },
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    // Real-Time Notification: Notify administrators of order cancellation
    createNotification({
      recipientId: null,
      recipientRole: 'ALL_ADMINS',
      type: 'ORDER_CANCEL_REQUESTED',
      title: 'Order Cancelled',
      message: `Order #${order.orderNumber} was cancelled. Reason: ${order.cancellationReason}`,
      category: 'ORDER',
      entityType: 'Order',
      entityId: order._id.toString(),
      actionUrl: `/admin/orders?search=${order.orderNumber}`,
      metadata: {
        orderNumber: order.orderNumber,
        status: 'CANCELLED',
      },
      idempotencyKey: `order_cancelled_admin_${order._id}`,
    }).catch((notifErr) => console.error('[notification] Order cancel admin notify error:', notifErr.message));

    // Real-Time Notification: Notify customer if cancellation initiated by administrator
    if (isAdmin && !isOwner) {
      createNotification({
        recipientId: order.customer,
        recipientRole: 'CUSTOMER',
        type: 'ORDER_STATUS_UPDATED',
        title: 'Order Cancelled',
        message: `Your order #${order.orderNumber} was cancelled. Reason: ${order.cancellationReason}`,
        category: 'ORDER',
        entityType: 'Order',
        entityId: order._id.toString(),
        actionUrl: `/account?tab=orders&orderId=${order._id}`,
        metadata: {
          orderNumber: order.orderNumber,
          status: 'CANCELLED',
        },
        idempotencyKey: `order_cancelled_cust_${order._id}`,
      }).catch((notifErr) => console.error('[notification] Order cancel customer notify error:', notifErr.message));
    }

    res.json({
      success: true,
      requestId: req.id,
      message: 'Order cancelled successfully and stock has been restored.',
      order,
    });
  } catch (err) {
    next(err);
  }
}
