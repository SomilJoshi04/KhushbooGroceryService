/**
 * Administrator Operations Controller.
 *
 * Provides real-time dashboard analytics, state-machine order management,
 * customer oversight, inventory adjustments, coupons, reports, and store settings.
 * All revenue calculations strictly use integer paise (100 paise = ₹1.00).
 *
 * @module controllers/adminController
 */

import mongoose from 'mongoose';
import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { User } from '../models/User.js';
import { Coupon } from '../models/Coupon.js';
import { StoreSetting } from '../models/StoreSetting.js';
import { DeliveryZone } from '../models/DeliveryZone.js';
import { InventoryMovement } from '../models/InventoryMovement.js';
import { AuditLog } from '../models/AuditLog.js';
import { restoreStockForOrder } from '../services/inventoryService.js';
import { createNotification } from '../services/notificationService.js';
import {
  parsePaginationParams,
  formatPaginatedResponse,
  buildPaginationMeta,
} from '../utils/pagination.js';
import { executeBulkOperation } from '../utils/bulkOperations.js';
import { emitToAll } from '../socket.js';

/**
 * Valid forward transitions for Order Status Machine.
 */
const VALID_ORDER_TRANSITIONS = {
  PLACED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [], // Terminal state
  CANCELLED: [], // Terminal state
};

/**
 * GET /api/v1/admin/dashboard
 * Aggregates live database metrics. Zero hardcoded statistics.
 */
export async function getDashboardStats(req, res, next) {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalOrders,
      ordersByStatusAgg,
      revenueAgg,
      todayOrdersAgg,
      activeProductsCount,
      customersCount,
      allProducts,
      recentOrders,
    ] = await Promise.all([
      Order.countDocuments(),
      Order.aggregate([
        { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        {
          $group: {
            _id: null,
            totalPaidPaise: {
              $sum: {
                $cond: [{ $eq: ['$payment.status', 'PAID'] }, '$pricing.grandTotalPaise', 0],
              },
            },
            codPaise: {
              $sum: {
                $cond: [{ $eq: ['$payment.method', 'COD'] }, '$pricing.grandTotalPaise', 0],
              },
            },
            onlinePaise: {
              $sum: {
                $cond: [{ $eq: ['$payment.method', 'ONLINE'] }, '$pricing.grandTotalPaise', 0],
              },
            },
          },
        },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: todayStart } } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            todaySalesPaise: {
              $sum: {
                $cond: [{ $ne: ['$orderStatus', 'CANCELLED'] }, '$pricing.grandTotalPaise', 0],
              },
            },
          },
        },
      ]),
      Product.countDocuments({ isPublished: true }),
      User.countDocuments({ role: 'CUSTOMER' }),
      Product.find({ isPublished: true }).select('name variants category').lean(),
      Order.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('customer', 'name phone email')
        .lean(),
    ]);

    // Format orders by status
    const statusCounts = {
      PLACED: 0,
      CONFIRMED: 0,
      PROCESSING: 0,
      OUT_FOR_DELIVERY: 0,
      DELIVERED: 0,
      CANCELLED: 0,
    };
    ordersByStatusAgg.forEach((item) => {
      if (statusCounts[item._id] !== undefined) {
        statusCounts[item._id] = item.count;
      }
    });

    // Detect low-stock variants (stock <= 10)
    const lowStockAlerts = [];
    allProducts.forEach((prod) => {
      prod.variants.forEach((v) => {
        if (v.stock <= 10) {
          lowStockAlerts.push({
            productId: prod._id,
            productName: prod.name,
            sku: v.sku,
            label: v.label,
            stock: v.stock,
            isOutOfStock: v.stock === 0,
          });
        }
      });
    });

    const revenueData = revenueAgg[0] || {
      totalPaidPaise: 0,
      codPaise: 0,
      onlinePaise: 0,
    };

    const todayData = todayOrdersAgg[0] || {
      count: 0,
      todaySalesPaise: 0,
    };

    res.json({
      success: true,
      requestId: req.id,
      data: {
        totalOrders,
        statusCounts,
        revenue: {
          totalPaidPaise: revenueData.totalPaidPaise,
          codPaise: revenueData.codPaise,
          onlinePaise: revenueData.onlinePaise,
        },
        today: {
          orderCount: todayData.count,
          salesPaise: todayData.todaySalesPaise,
        },
        activeProductsCount,
        customersCount,
        lowStockAlertsCount: lowStockAlerts.length,
        lowStockAlerts: lowStockAlerts.slice(0, 10),
        recentOrders,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/orders
 * Filterable, searchable, database-paginated list of all orders.
 * Default: exactly 6 orders per page.
 */
export async function getAllOrders(req, res, next) {
  try {
    const {
      status,
      paymentStatus,
      paymentMethod,
      search,
    } = req.query;

    const DEFAULT_PAGE = 1;
    const DEFAULT_LIMIT = 6;
    const MAX_LIMIT = 100;

    const rawPage = parseInt(req.query.page, 10);
    const rawLimit = parseInt(req.query.limit, 10);

    const pageNum = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : DEFAULT_PAGE;
    const limitNum = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT;

    const filter = {};

    if (status && status !== 'ALL' && typeof status === 'string') {
      const allowedStatuses = ['PLACED', 'CONFIRMED', 'PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
      if (allowedStatuses.includes(status)) {
        filter.orderStatus = status;
      }
    }
    if (paymentStatus && paymentStatus !== 'ALL' && typeof paymentStatus === 'string') {
      const allowedPaymentStatuses = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'];
      if (allowedPaymentStatuses.includes(paymentStatus)) {
        filter['payment.status'] = paymentStatus;
      }
    }
    if (paymentMethod && paymentMethod !== 'ALL' && typeof paymentMethod === 'string') {
      const allowedPaymentMethods = ['COD', 'ONLINE'];
      if (allowedPaymentMethods.includes(paymentMethod)) {
        filter['payment.method'] = paymentMethod;
      }
    }

    if (search && typeof search === 'string' && search.trim()) {
      const escaped = search.trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      filter.$or = [
        { orderNumber: regex },
        { 'deliveryAddress.recipientName': regex },
        { 'deliveryAddress.phone': regex },
        { 'deliveryAddress.street': regex },
      ];
    }

    // Explicit allowlist for sort fields to prevent query injection
    const ALLOWED_SORT_FIELDS = ['createdAt', 'orderNumber', 'pricing.grandTotalPaise'];
    let sortField = 'createdAt';
    let sortOrder = -1;
    if (req.query.sortBy && ALLOWED_SORT_FIELDS.includes(req.query.sortBy)) {
      sortField = req.query.sortBy;
    }
    if (req.query.sortOrder === 'asc' || req.query.sortOrder === '1') {
      sortOrder = 1;
    }
    const sortObj = { [sortField]: sortOrder, _id: -1 };

    const skip = (pageNum - 1) * limitNum;

    const [total, orders] = await Promise.all([
      Order.countDocuments(filter),
      Order.find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .populate('customer', 'name phone email')
        .lean(),
    ]);

    const totalPages = total > 0 ? Math.ceil(total / limitNum) : 0;
    const pagination = {
      currentPage: pageNum,
      pageSize: limitNum,
      totalOrders: total,
      totalPages,
      hasNextPage: pageNum < totalPages,
      hasPreviousPage: pageNum > 1 && totalPages > 0 && pageNum <= totalPages + 1,
      nextPage: pageNum < totalPages ? pageNum + 1 : null,
      previousPage: pageNum > 1 ? (totalPages > 0 ? Math.min(pageNum - 1, totalPages) : null) : null,
    };

    res.json({
      success: true,
      requestId: req.id,
      data: {
        orders,
        pagination,
      },
      count: orders.length,
      total,
      page: pageNum,
      totalPages,
    });
  } catch (err) {
    next(err);
  }
}

function getOrderStatusNotificationContent(orderNumber, status, note = '') {
  switch (status) {
    case 'CONFIRMED':
      return {
        title: 'Order Confirmed',
        message: `Your grocery order #${orderNumber} has been confirmed by the store and is being prepared.${note ? ` Note: ${note}` : ''}`,
      };
    case 'PROCESSING':
      return {
        title: 'Order Processing',
        message: `Your order #${orderNumber} is being packed and prepared for dispatch.${note ? ` Note: ${note}` : ''}`,
      };
    case 'OUT_FOR_DELIVERY':
      return {
        title: 'Order Out for Delivery',
        message: `Your order #${orderNumber} is out for delivery with our delivery partner.${note ? ` Note: ${note}` : ''}`,
      };
    case 'DELIVERED':
      return {
        title: 'Order Delivered',
        message: `Your grocery order #${orderNumber} has been successfully delivered. Thank you for shopping with Khushboo Grocery!`,
      };
    case 'CANCELLED':
      return {
        title: 'Order Cancelled',
        message: `Your order #${orderNumber} has been cancelled.${note ? ` Reason: ${note}` : ''}`,
      };
    default:
      return {
        title: `Order #${orderNumber} Status Updated`,
        message: `Your order status is now "${status}".${note ? ` Note: ${note}` : ''}`,
      };
  }
}

/**
 * PATCH /api/v1/admin/orders/:id/status
 * Enforces strict order state transitions and logs administrative changes.
 */
export async function updateOrderStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, note } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'Order not found.',
      });
    }

    const currentStatus = order.orderStatus;

    if (currentStatus === status) {
      return res.json({
        success: true,
        requestId: req.id,
        message: `Order is already in "${status}" status.`,
        order,
      });
    }

    const allowedNext = VALID_ORDER_TRANSITIONS[currentStatus] || [];
    if (!allowedNext.includes(status)) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: `Invalid state transition from "${currentStatus}" to "${status}". Allowed transitions: ${allowedNext.join(', ') || 'None (terminal)'}.`,
      });
    }

    // If cancelled, restore reserved stock atomically
    if (status === 'CANCELLED') {
      const itemsToRestore = order.items.map((i) => ({
        productId: i.product.toString(),
        sku: i.variantSku,
        quantity: i.quantity,
      }));

      await restoreStockForOrder(
        itemsToRestore,
        order._id.toString(),
        req.user._id.toString(),
        note || 'Order cancelled by store administrator'
      );
      order.cancellationReason = note || 'Admin cancellation';
    }

    // If COD order delivered, mark payment as PAID
    if (status === 'DELIVERED' && order.payment.method === 'COD' && order.payment.status !== 'PAID') {
      order.payment.status = 'PAID';
      order.payment.paidAt = new Date();
    }

    order.orderStatus = status;
    order.statusHistory.push({
      status,
      changedAt: new Date(),
      changedBy: req.user._id,
      note: note || `Status updated to ${status} by admin`,
    });

    await order.save();

    await AuditLog.create({
      action: 'ORDER_STATUS_UPDATE',
      performedBy: req.user._id,
      performerRole: req.user.role,
      targetType: 'Order',
      targetId: order._id.toString(),
      details: {
        orderNumber: order.orderNumber,
        from: currentStatus,
        to: status,
        note,
      },
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    // Real-Time Notification: Notify customer of order status update
    if (order.customer) {
      const notifContent = getOrderStatusNotificationContent(order.orderNumber, status, note);
      createNotification({
        recipientId: order.customer,
        recipientRole: 'CUSTOMER',
        type: 'ORDER_STATUS_UPDATED',
        title: notifContent.title,
        message: notifContent.message,
        category: 'ORDER',
        entityType: 'Order',
        entityId: order._id.toString(),
        actionUrl: `/account?tab=orders&orderId=${order._id}`,
        metadata: {
          orderNumber: order.orderNumber,
          status,
        },
        idempotencyKey: `order_status_update_${order._id}_${status}_${order.statusHistory.length}`,
      })
        .then(() => {
          console.info(`[adminController] Order #${order.orderNumber} status changed to ${status}. Dispatched customer notification to user:${order.customer}`);
        })
        .catch((notifErr) => console.error('[notification] Order status customer notify error:', notifErr.message));
    }

    res.json({
      success: true,
      requestId: req.id,
      message: `Order status updated to ${status} successfully.`,
      order,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/products
 * Administrative catalog listing with pagination, search, category, status, and stock filtering.
 */
export async function getAdminProducts(req, res, next) {
  try {
    const { page, limit, skip, sortObj } = parsePaginationParams(req.query, {
      defaultLimit: 10,
      maxLimit: 100,
      allowedSortFields: ['createdAt', 'name', 'updatedAt', 'isPublished'],
      defaultSortBy: 'createdAt',
      defaultSortOrder: 'desc',
    });

    const { search, category, status, stockStatus } = req.query;

    const filter = {};

    // Status filter
    if (status === 'PUBLISHED') {
      filter.isPublished = true;
    } else if (status === 'UNPUBLISHED') {
      filter.isPublished = false;
    }

    // Category filter
    if (category && category !== 'ALL' && mongoose.isValidObjectId(category)) {
      filter.category = new mongoose.Types.ObjectId(category);
    }

    // Keyword search across title, brand, tags, variant SKU
    if (search && typeof search === 'string' && search.trim()) {
      const sanitized = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(sanitized, 'i');
      filter.$or = [
        { name: searchRegex },
        { brand: searchRegex },
        { tags: searchRegex },
        { 'variants.sku': searchRegex },
        { 'variants.label': searchRegex },
      ];
    }

    // Stock status filter
    if (stockStatus === 'OUT_OF_STOCK') {
      filter.variants = { $not: { $elemMatch: { stock: { $gt: 0 } } } };
    } else if (stockStatus === 'LOW_STOCK') {
      filter.variants = { $elemMatch: { stock: { $gt: 0, $lte: 10 } } };
    } else if (stockStatus === 'IN_STOCK') {
      filter.variants = { $elemMatch: { stock: { $gt: 10 } } };
    }

    const [totalRecords, products] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter)
        .populate('category', 'name slug')
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return res.json(
      formatPaginatedResponse({
        req,
        data: products,
        totalRecords,
        page,
        limit,
      })
    );
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/customers
 * Returns customer accounts with total order count and total spend.
 */
export async function getAllCustomers(req, res, next) {
  try {
    const { page, limit, skip, sortObj } = parsePaginationParams(req.query, {
      defaultLimit: 10,
      maxLimit: 100,
      allowedSortFields: ['createdAt', 'name'],
      defaultSortBy: 'createdAt',
      defaultSortOrder: 'desc',
    });

    const { search, status } = req.query;

    const filter = { role: 'CUSTOMER' };

    if (status === 'ACTIVE') {
      filter.isActive = true;
      filter.isDeleted = false;
    } else if (status === 'SUSPENDED') {
      filter.isActive = false;
      filter.isDeleted = false;
    } else if (status === 'ANONYMIZED') {
      filter.isDeleted = true;
    }

    if (search && search.trim()) {
      const escaped = search.trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      filter.$or = [{ name: regex }, { phone: regex }, { email: regex }];
    }

    const [customers, total] = await Promise.all([
      User.find(filter)
        .select('-password')
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    // Aggregate orders for these customers
    const customerIds = customers.map((c) => c._id);
    const orderAgg = await Order.aggregate([
      { $match: { customer: { $in: customerIds } } },
      {
        $group: {
          _id: '$customer',
          orderCount: { $sum: 1 },
          totalSpentPaise: {
            $sum: {
              $cond: [{ $ne: ['$orderStatus', 'CANCELLED'] }, '$pricing.grandTotalPaise', 0],
            },
          },
          lastOrderAt: { $max: '$createdAt' },
        },
      },
    ]);

    const orderStatsMap = new Map();
    orderAgg.forEach((agg) => {
      orderStatsMap.set(agg._id.toString(), agg);
    });

    const enrichedCustomers = customers.map((c) => {
      const stats = orderStatsMap.get(c._id.toString()) || {
        orderCount: 0,
        totalSpentPaise: 0,
        lastOrderAt: null,
      };

      const phone = c.phone || '';
      const phoneMasked = phone.length >= 10
        ? `${phone.slice(0, 3)}****${phone.slice(-3)}`
        : phone;

      let accountStatus = 'ACTIVE';
      if (c.isDeleted) {
        accountStatus = 'ANONYMIZED';
      } else if (!c.isActive) {
        accountStatus = 'SUSPENDED';
      }

      return {
        ...c,
        phoneMasked,
        accountStatus,
        orderCount: stats.orderCount,
        totalSpentPaise: stats.totalSpentPaise,
        lastOrderAt: stats.lastOrderAt,
      };
    });

    return res.json(
      formatPaginatedResponse({
        req,
        data: enrichedCustomers,
        totalRecords: total,
        page,
        limit,
      })
    );
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/customers/:id/suspend
 * Suspends a customer account with mandatory reason, revoking all active sessions immediately.
 */
export async function suspendCustomer(req, res, next) {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'A mandatory suspension reason is required for security and compliance audits.',
      });
    }

    const customer = await User.findOne({ _id: id });
    if (!customer) {
      return res.status(404).json({ success: false, requestId: req.id, message: 'Customer not found.' });
    }

    if (customer.role === 'ADMIN' || customer.role === 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        requestId: req.id,
        message: 'Administrative accounts cannot be suspended through customer management.',
      });
    }

    customer.isActive = false;
    customer.suspendedAt = new Date();
    customer.suspendedReason = reason.trim();
    customer.suspendedBy = req.user._id;
    customer.sessionVersion = (customer.sessionVersion || 1) + 1; // Instantly revokes active tokens
    await customer.save();

    await AuditLog.create({
      action: 'CUSTOMER_SUSPEND',
      performedBy: req.user._id,
      performerRole: req.user.role,
      targetType: 'User',
      targetId: customer._id.toString(),
      details: { phone: customer.phone, reason: customer.suspendedReason },
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    res.json({
      success: true,
      requestId: req.id,
      message: `Customer ${customer.name} has been suspended. All active sessions have been invalidated.`,
      customer: customer.toSafeObject(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/customers/:id/restore
 * Restores a suspended customer account and resets sessionVersion.
 */
export async function restoreCustomer(req, res, next) {
  try {
    const { id } = req.params;
    const customer = await User.findOne({ _id: id });
    if (!customer) {
      return res.status(404).json({ success: false, requestId: req.id, message: 'Customer not found.' });
    }

    customer.isActive = true;
    customer.suspendedAt = null;
    customer.suspendedReason = '';
    customer.suspendedBy = null;
    customer.sessionVersion = (customer.sessionVersion || 1) + 1;
    await customer.save();

    await AuditLog.create({
      action: 'CUSTOMER_RESTORE',
      performedBy: req.user._id,
      performerRole: req.user.role,
      targetType: 'User',
      targetId: customer._id.toString(),
      details: { phone: customer.phone },
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    res.json({
      success: true,
      requestId: req.id,
      message: `Customer ${customer.name} has been successfully restored.`,
      customer: customer.toSafeObject(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/admin/customers/:id
 * Permanently deletes or anonymizes a customer account.
 * - If order records exist: Controlled anonymization preserves financial audit records.
 * - If 0 orders exist: Safe hard deletion.
 * - Blocks deleting administrative accounts or the last active super admin.
 */
export async function deleteCustomer(req, res, next) {
  try {
    const { id } = req.params;
    const customer = await User.findById(id);
    if (!customer) {
      return res.status(404).json({ success: false, requestId: req.id, message: 'Customer account not found.' });
    }

    if (customer.role === 'ADMIN' || customer.role === 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        requestId: req.id,
        message: 'Protected administrative accounts cannot be deleted. Deletion of administrators is restricted.',
      });
    }

    const orderCount = await Order.countDocuments({ customer: customer._id });

    if (orderCount > 0) {
      // Controlled Anonymization Workflow
      customer.name = 'Anonymized Customer';
      customer.phone = `ANON_${customer._id.toString()}`;
      customer.email = `anonymized_${customer._id.toString()}@khushboofood.local`;
      customer.addresses = [];
      customer.isActive = false;
      customer.isDeleted = true;
      customer.anonymizedAt = new Date();
      customer.sessionVersion = (customer.sessionVersion || 1) + 1;
      await customer.save();

      await AuditLog.create({
        action: 'CUSTOMER_ANONYMIZED_RETENTION_PRESERVED',
        performedBy: req.user._id,
        performerRole: req.user.role,
        targetType: 'User',
        targetId: customer._id.toString(),
        details: { orderCount, mode: 'ANONYMIZED' },
        ipAddress: req.ip || '',
        requestId: req.id,
      });

      return res.json({
        success: true,
        requestId: req.id,
        mode: 'ANONYMIZED',
        orderCount,
        message: `Customer personal data anonymized and addresses purged. ${orderCount} historical order and financial record(s) were preserved for legal & tax compliance.`,
      });
    } else {
      // Safe hard delete when 0 orders exist
      await User.deleteOne({ _id: customer._id });

      await AuditLog.create({
        action: 'CUSTOMER_SAFE_PURGE',
        performedBy: req.user._id,
        performerRole: req.user.role,
        targetType: 'User',
        targetId: customer._id.toString(),
        details: { mode: 'SAFE_PURGE' },
        ipAddress: req.ip || '',
        requestId: req.id,
      });

      return res.json({
        success: true,
        requestId: req.id,
        mode: 'PURGED',
        message: 'Customer record and personal data permanently purged (0 historical orders).',
      });
    }
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/admin/customers/:id/status
 * Legacy status toggle endpoint preserved for backward compatibility.
 */
export async function toggleCustomerStatus(req, res, next) {
  try {
    const { isActive, reason } = req.body;
    if (isActive) {
      return restoreCustomer(req, res, next);
    } else {
      req.body.reason = reason || 'Suspended by admin action';
      return suspendCustomer(req, res, next);
    }
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/admin/products/:id/stock
 * Adjusts inventory stock for a product variant with an audit trail.
 */
export async function updateProductStock(req, res, next) {
  try {
    const { id } = req.params;
    const { sku, stock, reason = 'Admin stock adjustment' } = req.body;

    if (stock === undefined || Number(stock) < 0 || !Number.isInteger(Number(stock))) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'Stock must be a non-negative integer.',
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'Product not found.',
      });
    }

    const variant = product.variants.find((v) => v.sku === sku);
    if (!variant) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: `Variant with SKU "${sku}" not found on product.`,
      });
    }

    const prevStock = variant.stock;
    const newStock = Number(stock);
    const diff = newStock - prevStock;

    variant.stock = newStock;
    await product.save();

    await InventoryMovement.create({
      product: product._id,
      variantSku: sku,
      quantityChange: diff,
      resultingStock: newStock,
      movementType: 'MANUAL_ADJUSTMENT',
      reason,
      performedBy: req.user._id,
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    // Real-Time Notification: Low stock alert if variant stock is 5 or below
    if (newStock <= 5) {
      createNotification({
        recipientGroup: 'ALL_ADMINS',
        type: 'LOW_STOCK_ALERT',
        title: 'Low Stock Alert',
        message: `${product.name} (${sku}) is low on stock (${newStock} units left).`,
        severity: newStock === 0 ? 'CRITICAL' : 'WARNING',
        category: 'INVENTORY',
        targetType: 'Product',
        targetId: product._id,
        targetUrl: `/admin/inventory?search=${sku}`,
        metadata: {
          productId: product._id,
          sku,
          stock: newStock,
          previousStock: prevStock,
        },
        idempotencyKey: `low_stock_${product._id}_${sku}_${newStock}`,
        actorId: req.user._id,
      }).catch((notifErr) => console.error('[notification] Low stock admin notify error:', notifErr.message));
    }

    res.json({
      success: true,
      requestId: req.id,
      message: `Stock for SKU ${sku} updated from ${prevStock} to ${newStock}.`,
      variant,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/inventory
 * Inventory overview of all product variants with low-stock filtering.
 * Fully paginated and aggregated at the database level.
 */
export async function getInventory(req, res, next) {
  try {
    const { page, limit, skip, sortObj } = parsePaginationParams(req.query, {
      defaultLimit: 10,
      maxLimit: 100,
      allowedSortFields: ['productName', 'stock', 'sku', 'pricePaise', 'createdAt', 'categoryName'],
      defaultSortBy: 'productName',
      defaultSortOrder: 'asc',
    });

    const { search, category, categoryId, stockStatus, lowStockOnly } = req.query;
    const targetCategory = categoryId || category;

    // Validate categoryId if provided and not ALL
    if (targetCategory && targetCategory !== 'ALL') {
      if (!mongoose.isValidObjectId(targetCategory)) {
        return res.status(400).json({
          success: false,
          requestId: req.id,
          message: `Invalid category ID format: "${targetCategory}".`,
        });
      }

      const categoryExists = await Category.findById(targetCategory).select('_id name isActive').lean();
      if (!categoryExists) {
        return res.status(404).json({
          success: false,
          requestId: req.id,
          message: 'The selected category was not found or has been removed.',
        });
      }
    }

    // Validate stockStatus if provided
    const ALLOWED_STOCK_STATUSES = ['ALL', 'LOW_STOCK', 'OUT_OF_STOCK', 'IN_STOCK'];
    if (stockStatus && !ALLOWED_STOCK_STATUSES.includes(stockStatus)) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: `Invalid stockStatus filter: "${stockStatus}". Allowed values: ${ALLOWED_STOCK_STATUSES.join(', ')}.`,
      });
    }

    const pipeline = [];

    // DATABASE OPTIMIZATION: If category filter is active, match at Product level first
    // using the { category: 1, createdAt: -1 } index BEFORE unwinding variants
    if (targetCategory && targetCategory !== 'ALL') {
      pipeline.push({
        $match: { category: new mongoose.Types.ObjectId(targetCategory) },
      });
    }

    pipeline.push(
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'categoryDoc',
        },
      },
      {
        $unwind: {
          path: '$categoryDoc',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $unwind: '$variants',
      },
      {
        $project: {
          _id: '$variants._id',
          productId: '$_id',
          productName: '$name',
          categoryName: { $ifNull: ['$categoryDoc.name', 'Uncategorized'] },
          categoryId: '$category',
          sku: '$variants.sku',
          label: '$variants.label',
          pricePaise: '$variants.pricePaise',
          mrpPaise: '$variants.mrpPaise',
          stock: '$variants.stock',
          unit: '$variants.unit',
          isActive: {
            $and: [
              { $ifNull: ['$variants.isActive', true] },
              { $ifNull: ['$isPublished', true] },
            ],
          },
          isLowStock: { $lte: ['$variants.stock', 10] },
          isOutOfStock: { $lte: ['$variants.stock', 0] },
          createdAt: '$createdAt',
        },
      }
    );

    const matchConditions = {};

    if (search && typeof search === 'string' && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reg = new RegExp(escaped, 'i');
      matchConditions.$or = [
        { productName: reg },
        { sku: reg },
        { label: reg },
        { categoryName: reg },
      ];
    }

    if (lowStockOnly === 'true' || stockStatus === 'LOW_STOCK') {
      matchConditions.stock = { $gt: 0, $lte: 10 };
    } else if (stockStatus === 'OUT_OF_STOCK') {
      matchConditions.stock = { $lte: 0 };
    } else if (stockStatus === 'IN_STOCK') {
      matchConditions.stock = { $gt: 10 };
    }

    if (Object.keys(matchConditions).length > 0) {
      pipeline.push({ $match: matchConditions });
    }

    const facetPipeline = [
      ...pipeline,
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [
            { $sort: sortObj },
            { $skip: skip },
            { $limit: limit },
          ],
        },
      },
    ];

    const result = await Product.aggregate(facetPipeline);
    const totalRecords = result[0]?.metadata[0]?.total || 0;
    const items = result[0]?.data || [];

    return res.json(
      formatPaginatedResponse({
        req,
        data: items,
        totalRecords,
        page,
        limit,
      })
    );
  } catch (err) {
    next(err);
  }
}

/**
 * Coupon Management Handlers
 */
export async function getCoupons(req, res, next) {
  try {
    const { page, limit, skip, sortObj } = parsePaginationParams(req.query, {
      defaultLimit: 10,
      maxLimit: 100,
      allowedSortFields: ['createdAt', 'code', 'expiryDate', 'discountPercentage'],
      defaultSortBy: 'createdAt',
      defaultSortOrder: 'desc',
    });

    const { search, status } = req.query;
    const filter = {};
    const now = new Date();

    if (status === 'ACTIVE') {
      filter.isActive = true;
      filter.expiryDate = { $gt: now };
    } else if (status === 'INACTIVE') {
      filter.isActive = false;
    } else if (status === 'EXPIRED') {
      filter.expiryDate = { $lte: now };
    }

    if (search && typeof search === 'string' && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reg = new RegExp(escaped, 'i');
      filter.$or = [{ code: reg }, { description: reg }];
    }

    const [totalRecords, coupons] = await Promise.all([
      Coupon.countDocuments(filter),
      Coupon.find(filter).sort(sortObj).skip(skip).limit(limit).lean(),
    ]);

    return res.json(
      formatPaginatedResponse({
        req,
        data: coupons,
        totalRecords,
        page,
        limit,
      })
    );
  } catch (err) {
    next(err);
  }
}

export async function createCoupon(req, res, next) {
  try {
    const couponData = req.body;
    couponData.code = couponData.code.toUpperCase().trim();

    const existing = await Coupon.findOne({ code: couponData.code });
    if (existing) {
      return res.status(409).json({
        success: false,
        requestId: req.id,
        message: `Coupon code "${couponData.code}" already exists.`,
      });
    }

    const coupon = await Coupon.create(couponData);

    await AuditLog.create({
      action: 'COUPON_CREATE',
      performedBy: req.user._id,
      performerRole: req.user.role,
      targetType: 'Coupon',
      targetId: coupon._id.toString(),
      details: { code: coupon.code, discountType: coupon.discountType, discountValue: coupon.discountValue },
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    // Real-Time Notification: Notify customers of published active coupon
    if (coupon.isActive) {
      createNotification({
        recipientGroup: 'ALL_CUSTOMERS',
        type: 'COUPON_PUBLISHED',
        title: 'New Discount Offer!',
        message: `Use code ${coupon.code} to get ${coupon.discountType === 'PERCENTAGE' ? `${coupon.discountValue}% OFF` : `₹${coupon.discountValue} OFF`} on your grocery orders!`,
        severity: 'SUCCESS',
        category: 'MARKETING',
        targetType: 'Coupon',
        targetId: coupon._id,
        targetUrl: '/cart',
        metadata: {
          couponCode: coupon.code,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
        },
        idempotencyKey: `coupon_pub_${coupon._id}`,
        actorId: req.user._id,
      }).catch((notifErr) => console.error('[notification] Coupon published customer notify error:', notifErr.message));
    }

    res.status(201).json({
      success: true,
      requestId: req.id,
      message: 'Coupon created successfully.',
      data: coupon,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateCoupon(req, res, next) {
  try {
    const { id } = req.params;
    const updates = req.body;

    const coupon = await Coupon.findByIdAndUpdate(id, updates, { new: true });
    if (!coupon) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'Coupon not found.',
      });
    }

    res.json({
      success: true,
      requestId: req.id,
      message: 'Coupon updated successfully.',
      data: coupon,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteCoupon(req, res, next) {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!coupon) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'Coupon not found.',
      });
    }

    res.json({
      success: true,
      requestId: req.id,
      message: 'Coupon deactivated successfully.',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Public Coupon Validation Endpoint
 * POST /api/v1/coupons/validate
 */
export async function validateCoupon(req, res, next) {
  try {
    const { code, subtotalPaise } = req.body;
    if (!code) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'Coupon code is required.',
      });
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase().trim() });
    if (!coupon) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'Invalid coupon code.',
      });
    }

    const check = coupon.isValidForCart(Number(subtotalPaise) || 0);
    if (!check.valid) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: check.reason,
      });
    }

    res.json({
      success: true,
      requestId: req.id,
      valid: true,
      code: coupon.code,
      discountPaise: check.discountPaise,
      discountRupees: (check.discountPaise / 100).toFixed(0),
      description: coupon.description,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Store & Delivery Settings Handlers
 */
export async function getStoreSettings(req, res, next) {
  try {
    let settings = await StoreSetting.findOne();
    if (!settings) {
      settings = await StoreSetting.create({});
    }

    const activeZones = await DeliveryZone.find({ isDeleted: false, isActive: true })
      .sort({ priority: -1, createdAt: 1 })
      .lean();

    const primaryZone = activeZones[0] || null;

    // Harmonize active thresholds between global store configuration and active delivery zones
    const effectiveMinOrderPaise = settings.minOrderAmountPaise ?? primaryZone?.minOrderAmountPaise ?? 15000;
    const effectiveDeliveryWindow = settings.estimatedDeliveryWindow || primaryZone?.estimatedDeliveryWindow || '90 - 120 Minutes';
    const effectiveFreeDeliveryPaise = settings.freeDeliveryThresholdPaise ?? primaryZone?.freeDeliveryThresholdPaise ?? 49900;

    let centralHub = 'Geeta Bhawan, MG Road';
    if (primaryZone?.dispatchLocation?.name) {
      centralHub = primaryZone.dispatchLocation.name;
    } else if (primaryZone?.name) {
      centralHub = primaryZone.name;
    } else if (settings.address) {
      const parts = settings.address.split(',').map((s) => s.trim()).filter(Boolean);
      centralHub = parts.length > 2 ? `${parts[1]}, ${parts[0]}` : parts[0] || 'Geeta Bhawan, MG Road';
    }

    res.json({
      success: true,
      requestId: req.id,
      data: {
        ...settings.toObject(),
        notificationSettings: {
          soundEnabled: settings.notificationSettings?.soundEnabled ?? true,
          soundCooldownSeconds: settings.notificationSettings?.soundCooldownSeconds ?? 3,
        },
        paymentSettings: {
          codEnabled: settings.paymentSettings?.codEnabled ?? true,
          onlinePaymentEnabled: settings.paymentSettings?.onlinePaymentEnabled ?? true,
        },
        userSoundEnabled: req.user?.soundEnabled ?? true,
        effectiveSoundEnabled: (settings.notificationSettings?.soundEnabled ?? true) && (req.user?.soundEnabled ?? true),
        effectiveMinOrderAmountPaise: effectiveMinOrderPaise,
        effectiveEstimatedDeliveryWindow: effectiveDeliveryWindow,
        effectiveFreeDeliveryThresholdPaise: effectiveFreeDeliveryPaise,
        centralHub,
        primaryZone: primaryZone
          ? {
              id: primaryZone._id,
              name: primaryZone.name,
              code: primaryZone.code,
              minOrderAmountPaise: primaryZone.minOrderAmountPaise,
              freeDeliveryThresholdPaise: primaryZone.freeDeliveryThresholdPaise,
              estimatedDeliveryWindow: primaryZone.estimatedDeliveryWindow,
              dispatchLocation: primaryZone.dispatchLocation,
              supportedPincodes: primaryZone.supportedPincodes,
            }
          : null,
        activeZones: activeZones.map((z) => ({
          id: z._id,
          name: z.name,
          code: z.code,
          minOrderAmountPaise: z.minOrderAmountPaise,
          estimatedDeliveryWindow: z.estimatedDeliveryWindow,
          supportedPincodes: z.supportedPincodes,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateStoreSettings(req, res, next) {
  try {
    const rawUpdates = req.body || {};
    let settings = await StoreSetting.findOne();
    if (!settings) {
      settings = await StoreSetting.create({});
    }

    // Determine target payment settings to strictly validate that at least one method is enabled
    const currentPayment = settings.paymentSettings || { codEnabled: true, onlinePaymentEnabled: true };
    const targetCod = rawUpdates.paymentSettings?.codEnabled !== undefined
      ? Boolean(rawUpdates.paymentSettings.codEnabled)
      : (rawUpdates.codEnabled !== undefined ? Boolean(rawUpdates.codEnabled) : currentPayment.codEnabled);

    const targetOnline = rawUpdates.paymentSettings?.onlinePaymentEnabled !== undefined
      ? Boolean(rawUpdates.paymentSettings.onlinePaymentEnabled)
      : (rawUpdates.onlinePaymentEnabled !== undefined ? Boolean(rawUpdates.onlinePaymentEnabled) : currentPayment.onlinePaymentEnabled);

    if (targetCod === false && targetOnline === false) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        code: 'INVALID_PAYMENT_CONFIG',
        error: 'INVALID_PAYMENT_CONFIG',
        message: 'At least one payment method (Cash on Delivery or Online Payment) must remain enabled.',
      });
    }

    // Allowlist of scalar fields
    const allowedScalars = [
      'storeName',
      'tagline',
      'contactPhone',
      'contactEmail',
      'address',
      'serviceCity',
      'servicePincode',
      'dispatchCoordinates',
      'isOpen',
      'announcementNotice',
      'minOrderAmountPaise',
      'freeDeliveryThresholdPaise',
      'deliveryFeeBasePaise',
      'maxDeliveryDistanceKm',
      'estimatedDeliveryWindow',
    ];

    for (const key of allowedScalars) {
      if (rawUpdates[key] !== undefined) {
        settings[key] = rawUpdates[key];
      }
    }

    // Handle notificationSettings allowlist
    if (!settings.notificationSettings) {
      settings.notificationSettings = { soundEnabled: true, soundCooldownSeconds: 3 };
    }
    if (rawUpdates.notificationSettings && typeof rawUpdates.notificationSettings === 'object') {
      if (rawUpdates.notificationSettings.soundEnabled !== undefined) {
        settings.notificationSettings.soundEnabled = Boolean(rawUpdates.notificationSettings.soundEnabled);
      }
      if (rawUpdates.notificationSettings.soundCooldownSeconds !== undefined) {
        const cd = Number(rawUpdates.notificationSettings.soundCooldownSeconds);
        if (Number.isFinite(cd) && cd >= 1 && cd <= 60) {
          settings.notificationSettings.soundCooldownSeconds = Math.round(cd);
        }
      }
    } else if (rawUpdates.soundEnabled !== undefined) {
      settings.notificationSettings.soundEnabled = Boolean(rawUpdates.soundEnabled);
    }

    // Handle paymentSettings
    settings.paymentSettings = {
      codEnabled: targetCod,
      onlinePaymentEnabled: targetOnline,
    };

    await settings.save();

    // Synchronize to active delivery zones if min order, free delivery or window updated
    const zoneSyncUpdates = {};
    if (rawUpdates.minOrderAmountPaise !== undefined) zoneSyncUpdates.minOrderAmountPaise = Number(rawUpdates.minOrderAmountPaise);
    if (rawUpdates.freeDeliveryThresholdPaise !== undefined) zoneSyncUpdates.freeDeliveryThresholdPaise = Number(rawUpdates.freeDeliveryThresholdPaise);
    if (rawUpdates.estimatedDeliveryWindow) zoneSyncUpdates.estimatedDeliveryWindow = rawUpdates.estimatedDeliveryWindow;

    if (Object.keys(zoneSyncUpdates).length > 0) {
      await DeliveryZone.updateMany({ isDeleted: false, isActive: true }, { $set: zoneSyncUpdates });
    }

    // Real-time broadcast to all connected sessions (customers & admins)
    emitToAll('settings:updated', {
      notificationSettings: {
        soundEnabled: settings.notificationSettings.soundEnabled,
        soundCooldownSeconds: settings.notificationSettings.soundCooldownSeconds,
      },
      paymentSettings: {
        codEnabled: settings.paymentSettings.codEnabled,
        onlinePaymentEnabled: settings.paymentSettings.onlinePaymentEnabled,
      },
      isOpen: settings.isOpen,
      announcementNotice: settings.announcementNotice,
    });

    await AuditLog.create({
      action: 'STORE_SETTINGS_UPDATE',
      performedBy: req.user._id,
      performerRole: req.user.role,
      targetType: 'StoreSetting',
      targetId: settings._id.toString(),
      details: {
        updatedFields: Object.keys(rawUpdates),
        paymentSettings: settings.paymentSettings,
        notificationSettings: settings.notificationSettings,
      },
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    res.json({
      success: true,
      requestId: req.id,
      message: 'Store settings updated successfully.',
      data: settings,
      settings: settings,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/reports
 * Real statistical breakdown for sales, categories, and payment types.
 * Supports pagination for top-selling items while computing high-level KPIs across full scope.
 */
export async function getReports(req, res, next) {
  try {
    const rawPage = req.query.productsPage || req.query.page;
    const rawLimit = req.query.productsLimit || req.query.limit;

    const { page, limit, skip } = parsePaginationParams(
      { page: rawPage, limit: rawLimit },
      { defaultLimit: 10, maxLimit: 50 }
    );

    const [ordersByPayment, ordersByMonth, topSellingProductsFacet] = await Promise.all([
      Order.aggregate([
        { $match: { orderStatus: { $ne: 'CANCELLED' } } },
        {
          $group: {
            _id: '$payment.method',
            count: { $sum: 1 },
            revenuePaise: { $sum: '$pricing.grandTotalPaise' },
          },
        },
      ]),
      Order.aggregate([
        { $match: { orderStatus: { $ne: 'CANCELLED' } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            orders: { $sum: 1 },
            revenuePaise: { $sum: '$pricing.grandTotalPaise' },
          },
        },
        { $sort: { _id: -1 } },
        { $limit: 14 },
      ]),
      Order.aggregate([
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.productName',
            totalUnitsSold: { $sum: '$items.quantity' },
            revenuePaise: { $sum: '$items.subtotalPaise' },
          },
        },
        {
          $facet: {
            total: [{ $count: 'count' }],
            data: [
              { $sort: { totalUnitsSold: -1, _id: 1 } },
              { $skip: skip },
              { $limit: limit },
            ],
          },
        },
      ]),
    ]);

    const totalProductsSold = topSellingProductsFacet[0]?.total[0]?.count || 0;
    const topSellingProducts = topSellingProductsFacet[0]?.data || [];
    const productsPagination = buildPaginationMeta({
      page,
      limit,
      totalRecords: totalProductsSold,
    });

    res.json({
      success: true,
      requestId: req.id,
      data: {
        ordersByPayment,
        recentDaysSales: ordersByMonth.reverse(),
        topSellingProducts,
        pagination: productsPagination,
      },
      pagination: productsPagination,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin Profile Handlers
 */
export async function getAdminProfile(req, res) {
  res.json({
    success: true,
    requestId: req.id,
    data: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      phone: req.user.phone,
      role: req.user.role,
      soundEnabled: req.user.soundEnabled ?? true,
      lastLoginAt: req.user.lastLoginAt,
      createdAt: req.user.createdAt,
    },
  });
}

export async function updateAdminProfile(req, res, next) {
  try {
    const { name, email, soundEnabled } = req.body;

    if (name) req.user.name = name;
    if (email) req.user.email = email.toLowerCase().trim();
    if (soundEnabled !== undefined) req.user.soundEnabled = Boolean(soundEnabled);

    await req.user.save();

    res.json({
      success: true,
      requestId: req.id,
      message: 'Admin profile updated successfully.',
      data: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone,
        role: req.user.role,
        soundEnabled: req.user.soundEnabled ?? true,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/customers/deletion-requests
 * Lists all customer deletion requests for compliance review.
 */
export async function getDeletionRequests(req, res, next) {
  try {
    const customers = await User.find({
      'deletionRequest.requested': true,
    })
      .select('name phone email role isActive isDeleted deletionRequest createdAt')
      .sort({ 'deletionRequest.requestedAt': -1 })
      .lean();

    res.json({
      success: true,
      requestId: req.id,
      count: customers.length,
      deletionRequests: customers,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/customers/:id/deletion-request
 * Approves or rejects a customer deletion request.
 */
export async function processDeletionRequest(req, res, next) {
  try {
    const { id } = req.params;
    const { action, adminNotes = '' } = req.body;

    const customer = await User.findById(id);
    if (!customer) {
      return res.status(404).json({ success: false, requestId: req.id, message: 'Customer not found.' });
    }

    if (action === 'APPROVE') {
      customer.deletionRequest.status = 'APPROVED';
      customer.deletionRequest.reviewedBy = req.user._id;
      customer.deletionRequest.reviewedAt = new Date();
      customer.deletionRequest.adminNotes = adminNotes;

      const orderCount = await Order.countDocuments({ customer: customer._id });
      if (orderCount > 0) {
        customer.name = 'Anonymized Customer';
        customer.phone = `+9100000${customer._id.toString().slice(-5)}`;
        customer.email = `anonymized_${customer._id.toString()}@khushboofood.local`;
        customer.addresses = [];
        customer.isActive = false;
        customer.isDeleted = true;
        customer.anonymizedAt = new Date();
        customer.sessionVersion = (customer.sessionVersion || 1) + 1;
        await customer.save();
      } else {
        customer.isActive = false;
        customer.isDeleted = true;
        customer.anonymizedAt = new Date();
        customer.sessionVersion = (customer.sessionVersion || 1) + 1;
        await customer.save();
      }

      await AuditLog.create({
        action: 'CUSTOMER_DELETION_APPROVED',
        performedBy: req.user._id,
        performerRole: req.user.role,
        targetType: 'User',
        targetId: customer._id.toString(),
        details: { phone: customer.phone, adminNotes, orderCount },
        ipAddress: req.ip || '',
        requestId: req.id,
      });

      return res.json({
        success: true,
        requestId: req.id,
        message: 'Customer deletion request approved and processed.',
        customer: customer.toSafeObject(),
      });
    } else if (action === 'REJECT') {
      customer.deletionRequest.status = 'REJECTED';
      customer.deletionRequest.reviewedBy = req.user._id;
      customer.deletionRequest.reviewedAt = new Date();
      customer.deletionRequest.adminNotes = adminNotes;
      await customer.save();

      await AuditLog.create({
        action: 'CUSTOMER_DELETION_REJECTED',
        performedBy: req.user._id,
        performerRole: req.user.role,
        targetType: 'User',
        targetId: customer._id.toString(),
        details: { phone: customer.phone, adminNotes },
        ipAddress: req.ip || '',
        requestId: req.id,
      });

      return res.json({
        success: true,
        requestId: req.id,
        message: 'Customer deletion request rejected.',
        customer: customer.toSafeObject(),
      });
    }

    res.status(400).json({
      success: false,
      requestId: req.id,
      message: 'Invalid action. Must be APPROVE or REJECT.',
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk Operations Section
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/admin/customers/bulk-suspend
 * Bulk suspends selected customers with a mandatory audit reason.
 */
export async function bulkSuspendCustomers(req, res, next) {
  try {
    const { ids, selectAllMatching, filter, reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A mandatory suspension reason is required for bulk customer suspension.',
      });
    }

    const baseFilter = { role: 'CUSTOMER', isDeleted: false, isActive: true };
    if (filter?.search) {
      const regex = new RegExp(filter.search.trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
      baseFilter.$or = [{ name: regex }, { phone: regex }, { email: regex }];
    }

    const result = await executeBulkOperation({
      req,
      model: User,
      ids,
      selectAllMatching,
      filter: baseFilter,
      actionName: 'BULK_CUSTOMER_SUSPEND',
      entityName: 'User',
      context: { reason: reason.trim() },
      handler: async (doc, ctx) => {
        if (doc._id.toString() === ctx.adminId?.toString()) {
          return { status: 'skipped', reason: 'Cannot suspend your own active administrator account.' };
        }
        if (doc.role === 'ADMIN' || doc.role === 'SUPER_ADMIN') {
          return { status: 'skipped', reason: 'Administrative accounts cannot be suspended.' };
        }
        if (doc.isDeleted) {
          return { status: 'skipped', reason: 'Account is deleted or anonymized.' };
        }
        if (!doc.isActive) {
          return { status: 'skipped', reason: 'Account is already suspended.' };
        }

        doc.isActive = false;
        doc.suspendedAt = new Date();
        doc.suspendedReason = ctx.reason;
        doc.suspendedBy = ctx.adminId;
        doc.sessionVersion = (doc.sessionVersion || 1) + 1;
        await doc.save();

        return { status: 'success' };
      },
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/customers/bulk-restore
 * Bulk restores suspended customer accounts.
 */
export async function bulkRestoreCustomers(req, res, next) {
  try {
    const { ids, selectAllMatching, filter } = req.body;

    const baseFilter = { role: 'CUSTOMER', isDeleted: false, isActive: false };
    if (filter?.search) {
      const regex = new RegExp(filter.search.trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
      baseFilter.$or = [{ name: regex }, { phone: regex }, { email: regex }];
    }

    const result = await executeBulkOperation({
      req,
      model: User,
      ids,
      selectAllMatching,
      filter: baseFilter,
      actionName: 'BULK_CUSTOMER_RESTORE',
      entityName: 'User',
      handler: async (doc, ctx) => {
        if (doc.isActive) {
          return { status: 'skipped', reason: 'Account is already active.' };
        }
        if (doc.isDeleted) {
          return { status: 'skipped', reason: 'Account is deleted/anonymized.' };
        }

        doc.isActive = true;
        doc.suspendedAt = null;
        doc.suspendedReason = '';
        doc.suspendedBy = null;
        doc.sessionVersion = (doc.sessionVersion || 1) + 1;
        await doc.save();

        return { status: 'success' };
      },
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/customers/bulk-delete
 * Bulk deletes customer accounts: anonymizes if orders exist; purges if 0 orders.
 */
export async function bulkDeleteCustomers(req, res, next) {
  try {
    const { ids, selectAllMatching, filter } = req.body;

    const baseFilter = { role: 'CUSTOMER', isDeleted: false };
    if (filter?.search) {
      const regex = new RegExp(filter.search.trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
      baseFilter.$or = [{ name: regex }, { phone: regex }, { email: regex }];
    }

    const result = await executeBulkOperation({
      req,
      model: User,
      ids,
      selectAllMatching,
      filter: baseFilter,
      actionName: 'BULK_CUSTOMER_DELETE',
      entityName: 'User',
      handler: async (doc, ctx) => {
        if (doc._id.toString() === ctx.adminId?.toString()) {
          return { status: 'skipped', reason: 'Cannot delete your own active administrator account.' };
        }
        if (doc.role === 'ADMIN' || doc.role === 'SUPER_ADMIN') {
          return { status: 'skipped', reason: 'Administrative accounts cannot be deleted.' };
        }
        if (doc.isDeleted) {
          return { status: 'skipped', reason: 'Account is already deleted/anonymized.' };
        }

        const orderCount = await Order.countDocuments({ customer: doc._id });

        if (orderCount > 0) {
          // Controlled Anonymization Workflow preserving financial & order history
          doc.name = 'Anonymized Customer';
          doc.phone = `ANON_${doc._id.toString()}`;
          doc.email = `anonymized_${doc._id.toString()}@khushboofood.local`;
          doc.addresses = [];
          doc.isActive = false;
          doc.isDeleted = true;
          doc.anonymizedAt = new Date();
          doc.sessionVersion = (doc.sessionVersion || 1) + 1;
          await doc.save();

          return {
            status: 'success',
            note: `Anonymized (${orderCount} orders preserved for legal retention)`,
          };
        } else {
          // Safe hard purge when 0 orders exist
          await User.deleteOne({ _id: doc._id });
          return { status: 'success', note: 'Permanently purged (0 orders)' };
        }
      },
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/products/bulk-status
 * Bulk publishes or unpublishes products.
 */
export async function bulkUpdateProductStatus(req, res, next) {
  try {
    const { ids, selectAllMatching, filter, isPublished } = req.body;

    if (typeof isPublished !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'A boolean "isPublished" flag is required.',
      });
    }

    const baseFilter = {};
    if (filter?.category && filter.category !== 'ALL' && mongoose.isValidObjectId(filter.category)) {
      baseFilter.category = new mongoose.Types.ObjectId(filter.category);
    }

    const result = await executeBulkOperation({
      req,
      model: Product,
      ids,
      selectAllMatching,
      filter: baseFilter,
      actionName: 'BULK_PRODUCT_STATUS_UPDATE',
      entityName: 'Product',
      context: { targetStatus: isPublished ? 'PUBLISHED' : 'ARCHIVED' },
      handler: async (doc) => {
        if (doc.isPublished === isPublished) {
          return { status: 'skipped', reason: `Product is already ${isPublished ? 'published' : 'archived'}.` };
        }

        doc.isPublished = isPublished;
        doc.updatedBy = req.user._id;
        await doc.save();

        return { status: 'success' };
      },
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/products/bulk-delete
 * Bulk deletes products safely: unpublishes/archives if orders reference it; purges if 0 orders.
 */
export async function bulkDeleteProducts(req, res, next) {
  try {
    const { ids, selectAllMatching, filter } = req.body;

    const baseFilter = {};
    if (filter?.category && filter.category !== 'ALL' && mongoose.isValidObjectId(filter.category)) {
      baseFilter.category = new mongoose.Types.ObjectId(filter.category);
    }

    const result = await executeBulkOperation({
      req,
      model: Product,
      ids,
      selectAllMatching,
      filter: baseFilter,
      actionName: 'BULK_PRODUCT_DELETE',
      entityName: 'Product',
      handler: async (doc) => {
        const orderCount = await Order.countDocuments({ 'items.product': doc._id });

        if (orderCount > 0) {
          // Cannot hard delete because historical invoices and order snapshots depend on it
          doc.isPublished = false;
          doc.updatedBy = req.user._id;
          await doc.save();
          return {
            status: 'skipped',
            reason: `Referenced by ${orderCount} historical order(s). Product was archived instead to preserve order integrity.`,
          };
        }

        await Product.deleteOne({ _id: doc._id });
        return { status: 'success', note: 'Permanently deleted (0 historical orders)' };
      },
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/inventory/bulk-adjust
 * Bulk adjusts stock for selected variant SKUs with mandatory audit reason.
 */
export async function bulkAdjustStock(req, res, next) {
  try {
    const { adjustments, delta, reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A mandatory reason is required for bulk stock adjustment audits.',
      });
    }

    if (!Array.isArray(adjustments) || adjustments.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'A list of adjustments with SKU and quantity change is required.',
      });
    }

    let succeeded = 0;
    let skipped = 0;
    let failed = 0;
    const results = [];

    for (const item of adjustments) {
      const sku = item.sku?.trim();
      const quantityChange = Number(item.delta !== undefined ? item.delta : delta);

      if (!sku || isNaN(quantityChange)) {
        skipped++;
        results.push({ sku, status: 'skipped', reason: 'Invalid SKU or quantity change.' });
        continue;
      }

      try {
        const product = await Product.findOne({ 'variants.sku': sku });
        if (!product) {
          skipped++;
          results.push({ sku, status: 'skipped', reason: `Variant SKU "${sku}" not found.` });
          continue;
        }

        const variant = product.variants.find((v) => v.sku === sku);
        if (!variant) {
          skipped++;
          results.push({ sku, status: 'skipped', reason: 'Variant not found on product.' });
          continue;
        }

        const previousStock = variant.stock;
        const newStock = Math.max(0, previousStock + quantityChange);
        variant.stock = newStock;
        await product.save();

        // Record inventory movement
        await InventoryMovement.create({
          product: product._id,
          sku,
          change: quantityChange,
          type: quantityChange >= 0 ? 'RESTOCK' : 'ADJUSTMENT',
          previousStock,
          newStock,
          reason: reason.trim(),
          performedBy: req.user._id,
        });

        succeeded++;
        results.push({ sku, status: 'success', previousStock, newStock });
      } catch (itemErr) {
        failed++;
        results.push({ sku, status: 'failed', reason: itemErr.message });
      }
    }

    await AuditLog.create({
      action: 'BULK_STOCK_ADJUSTMENT',
      performedBy: req.user._id,
      performerRole: req.user.role,
      targetType: 'Inventory',
      targetId: 'BULK_BATCH',
      details: {
        totalRequested: adjustments.length,
        succeeded,
        skipped,
        failed,
        reason: reason.trim(),
      },
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    res.json({
      success: true,
      summary: {
        requested: adjustments.length,
        succeeded,
        skipped,
        failed,
      },
      results,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/coupons/bulk-status
 * Bulk activates or deactivates coupons.
 */
export async function bulkUpdateCouponStatus(req, res, next) {
  try {
    const { ids, selectAllMatching, filter, isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'A boolean "isActive" flag is required.',
      });
    }

    const baseFilter = {};
    const result = await executeBulkOperation({
      req,
      model: Coupon,
      ids,
      selectAllMatching,
      filter: baseFilter,
      actionName: 'BULK_COUPON_STATUS_UPDATE',
      entityName: 'Coupon',
      context: { targetStatus: isActive ? 'ACTIVE' : 'INACTIVE' },
      handler: async (doc) => {
        if (doc.isActive === isActive) {
          return { status: 'skipped', reason: `Coupon is already ${isActive ? 'active' : 'inactive'}.` };
        }

        doc.isActive = isActive;
        await doc.save();
        return { status: 'success' };
      },
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/coupons/bulk-delete
 * Bulk deletes coupons: deactivates if redemptions exist to preserve financial records; purges if 0 redemptions.
 */
export async function bulkDeleteCoupons(req, res, next) {
  try {
    const { ids, selectAllMatching, filter } = req.body;

    const baseFilter = {};
    const result = await executeBulkOperation({
      req,
      model: Coupon,
      ids,
      selectAllMatching,
      filter: baseFilter,
      actionName: 'BULK_COUPON_DELETE',
      entityName: 'Coupon',
      handler: async (doc) => {
        if (doc.timesUsed > 0) {
          doc.isActive = false;
          await doc.save();
          return {
            status: 'skipped',
            reason: `Coupon has been used ${doc.timesUsed} time(s). Deactivated instead to protect financial audit history.`,
          };
        }

        await Coupon.deleteOne({ _id: doc._id });
        return { status: 'success', note: 'Permanently deleted (0 redemptions)' };
      },
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/orders/bulk-status
 * Bulk updates order statuses respecting state-machine transitions.
 */
export async function bulkUpdateOrderStatus(req, res, next) {
  try {
    const { ids, selectAllMatching, filter, status, note } = req.body;

    if (!status || !VALID_ORDER_TRANSITIONS[status] && status !== 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: `Invalid order target status: "${status}".`,
      });
    }

    const baseFilter = {};
    if (filter?.status && filter.status !== 'ALL') {
      baseFilter.orderStatus = filter.status;
    }

    const result = await executeBulkOperation({
      req,
      model: Order,
      ids,
      selectAllMatching,
      filter: baseFilter,
      actionName: 'BULK_ORDER_STATUS_UPDATE',
      entityName: 'Order',
      context: { targetStatus: status, note },
      handler: async (doc, ctx) => {
        const currentStatus = doc.orderStatus;

        if (currentStatus === ctx.targetStatus) {
          return { status: 'skipped', reason: `Order is already ${ctx.targetStatus}.` };
        }

        const allowedTransitions = VALID_ORDER_TRANSITIONS[currentStatus] || [];
        if (!allowedTransitions.includes(ctx.targetStatus)) {
          return {
            status: 'skipped',
            reason: `Invalid status transition from "${currentStatus}" to "${ctx.targetStatus}".`,
          };
        }

        doc.orderStatus = ctx.targetStatus;
        doc.statusHistory.push({
          status: ctx.targetStatus,
          changedAt: new Date(),
          changedBy: ctx.adminId,
          note: ctx.note || `Bulk status update to ${ctx.targetStatus}`,
        });

        // Stock restoration if cancelled
        if (ctx.targetStatus === 'CANCELLED' && currentStatus !== 'CANCELLED') {
          try {
            await restoreStockForOrder(doc);
          } catch (restoreErr) {
            console.error(`[Inventory] Stock restoration error for order ${doc.orderNumber}:`, restoreErr.message);
          }
        }

        await doc.save();

        if (doc.customer) {
          const notifContent = getOrderStatusNotificationContent(doc.orderNumber, ctx.targetStatus, ctx.note);
          createNotification({
            recipientId: doc.customer,
            recipientRole: 'CUSTOMER',
            type: 'ORDER_STATUS_UPDATED',
            title: notifContent.title,
            message: notifContent.message,
            category: 'ORDER',
            entityType: 'Order',
            entityId: doc._id.toString(),
            actionUrl: `/account?tab=orders&orderId=${doc._id}`,
            metadata: {
              orderNumber: doc.orderNumber,
              status: ctx.targetStatus,
            },
            idempotencyKey: `order_bulk_status_${doc._id}_${ctx.targetStatus}_${doc.statusHistory.length}`,
          })
            .then(() => {
              console.info(`[adminController] Bulk order #${doc.orderNumber} status changed to ${ctx.targetStatus}. Dispatched to user:${doc.customer}`);
            })
            .catch((notifErr) => console.error('[notification] Bulk order status customer notify error:', notifErr.message));
        }

        return { status: 'success' };
      },
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}


