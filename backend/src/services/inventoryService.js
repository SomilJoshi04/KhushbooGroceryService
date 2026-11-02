/**
 * Inventory & Stock Integrity Service.
 *
 * Implements race-condition-safe atomic stock deduction and restoration
 * using conditional atomic operators ($inc with $gte guard).
 * Fully compatible with MongoDB Atlas M0 (does not rely on multi-document transactions).
 *
 * @module services/inventoryService
 */

import { Product } from '../models/Product.js';
import { InventoryMovement } from '../models/InventoryMovement.js';
import { createNotification } from './notificationService.js';

export class InsufficientStockError extends Error {
  constructor(sku, requested, available) {
    super(`Insufficient stock for item (${sku}). Requested: ${requested}, Available: ${available}`);
    this.name = 'InsufficientStockError';
    this.sku = sku;
    this.requested = requested;
    this.available = available;
    this.statusCode = 409;
  }
}

/**
 * Atomically deducts stock for an array of order items.
 * If any single item has insufficient stock, rolls back all previous
 * items deducted during this batch operation.
 *
 * @param {Array<{productId: string, sku: string, quantity: number}>} items
 * @param {string} orderId
 * @param {string} [userId]
 * @returns {Promise<{success: boolean, deductedItems: Array}>}
 */
export async function deductStockForOrder(items, orderId, userId = null) {
  const successfullyDeducted = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const qty = Number(item.quantity);

    // Conditional atomic deduction: only succeeds if stock >= qty
    const productBefore = await Product.findOneAndUpdate(
      {
        _id: item.productId,
        'variants.sku': item.sku,
        'variants.stock': { $gte: qty },
      },
      {
        $inc: { 'variants.$.stock': -qty },
      },
      { returnDocument: 'before' } // return document before update to record previous stock
    );

    if (!productBefore) {
      // Find current stock to give a descriptive error
      const currentProd = await Product.findOne(
        { _id: item.productId, 'variants.sku': item.sku },
        { 'variants.$': 1 }
      );
      const availableStock = currentProd?.variants?.[0]?.stock ?? 0;

      // Rollback all items that were deducted prior to this failure
      for (const prev of successfullyDeducted) {
        await Product.updateOne(
          { _id: prev.productId, 'variants.sku': prev.sku },
          { $inc: { 'variants.$.stock': prev.quantity } }
        );
      }

      throw new InsufficientStockError(item.sku, qty, availableStock);
    }

    const variantBefore = productBefore.variants.find((v) => v.sku === item.sku);
    const prevStock = variantBefore ? variantBefore.stock : qty;
    const newStock = prevStock - qty;

    successfullyDeducted.push({
      productId: item.productId,
      sku: item.sku,
      quantity: qty,
      previousStock: prevStock,
      newStock,
    });
  }

  // Record audit log for all successful deductions
  const movements = successfullyDeducted.map((d) => ({
    product: d.productId,
    sku: d.sku,
    type: 'SALE_DEDUCTION',
    quantityDelta: -d.quantity,
    previousStock: d.previousStock,
    newStock: d.newStock,
    orderId,
    performedBy: userId,
    reason: `Order #${orderId} placement`,
  }));

  await InventoryMovement.insertMany(movements);

  // Dispatch low stock warning notifications to administrators for depleted variants (<= 5 units)
  for (const d of successfullyDeducted) {
    if (d.newStock <= 5) {
      createNotification({
        recipientGroup: 'ALL_ADMINS',
        type: 'LOW_STOCK_ALERT',
        title: 'Low Stock Alert',
        message: `SKU "${d.sku}" is running low on stock (${d.newStock} units left) following order #${orderId}.`,
        severity: d.newStock === 0 ? 'CRITICAL' : 'WARNING',
        category: 'INVENTORY',
        targetType: 'Product',
        targetId: d.productId,
        targetUrl: `/admin/inventory?search=${d.sku}`,
        metadata: {
          productId: d.productId,
          sku: d.sku,
          stock: d.newStock,
          orderId,
        },
        idempotencyKey: `low_stock_${d.productId}_${d.sku}_${d.newStock}`,
        actorId: userId,
      }).catch((notifErr) => console.error('[notification] Low stock deduction notify error:', notifErr.message));
    }
  }

  return {
    success: true,
    deductedItems: successfullyDeducted,
  };
}

/**
 * Atomically restores stock when an order is cancelled or payment fails.
 *
 * @param {Array<{productId: string, sku: string, quantity: number}>} items
 * @param {string} orderId
 * @param {string} [userId]
 * @param {string} [reason]
 */
export async function restoreStockForOrder(items, orderId, userId = null, reason = 'Order Cancelled') {
  const movements = [];

  for (const item of items) {
    const qty = Number(item.quantity);

    const updated = await Product.findOneAndUpdate(
      { _id: item.productId, 'variants.sku': item.sku },
      { $inc: { 'variants.$.stock': qty } },
      { returnDocument: 'after' }
    );

    if (updated) {
      const variant = updated.variants.find((v) => v.sku === item.sku);
      const newStock = variant ? variant.stock : qty;
      const prevStock = newStock - qty;

      movements.push({
        product: item.productId,
        sku: item.sku,
        type: 'ORDER_CANCELLED_RESTORE',
        quantityDelta: qty,
        previousStock: Math.max(0, prevStock),
        newStock,
        orderId,
        performedBy: userId,
        reason,
      });
    }
  }

  if (movements.length > 0) {
    await InventoryMovement.insertMany(movements);
  }

  return { success: true, restoredCount: movements.length };
}

/**
 * Manual administrative stock adjustment with full audit trail.
 *
 * @param {string} productId
 * @param {string} sku
 * @param {number} newStockCount
 * @param {string} reason
 * @param {string} adminId
 */
export async function adjustStock(productId, sku, newStockCount, reason, adminId) {
  const newStock = Math.max(0, Math.floor(Number(newStockCount)));

  const productBefore = await Product.findOne(
    { _id: productId, 'variants.sku': sku },
    { 'variants.$': 1 }
  );

  if (!productBefore || !productBefore.variants?.[0]) {
    throw new Error(`Variant with SKU "${sku}" not found on product.`);
  }

  const prevStock = productBefore.variants[0].stock;
  const delta = newStock - prevStock;

  await Product.updateOne(
    { _id: productId, 'variants.sku': sku },
    { $set: { 'variants.$.stock': newStock } }
  );

  await InventoryMovement.create({
    product: productId,
    sku,
    type: 'MANUAL_AUDIT_ADJUSTMENT',
    quantityDelta: delta,
    previousStock: prevStock,
    newStock,
    performedBy: adminId,
    reason: reason || 'Manual stock update via Admin Dashboard',
  });

  return {
    success: true,
    sku,
    previousStock: prevStock,
    newStock,
    delta,
  };
}

/**
 * Returns low stock alerts where variant stock is <= threshold.
 *
 * @param {number} threshold
 */
export async function getLowStockAlerts(threshold = 5) {
  const products = await Product.find({
    isPublished: true,
    'variants.stock': { $lte: threshold },
  })
    .populate('category', 'name slug')
    .lean();

  const alerts = [];
  products.forEach((prod) => {
    prod.variants.forEach((v) => {
      if (v.stock <= threshold) {
        alerts.push({
          productId: prod._id,
          productName: prod.name,
          categoryName: prod.category?.name || 'General',
          sku: v.sku,
          label: v.label,
          currentStock: v.stock,
          priceRupees: v.pricePaise / 100,
          isOutOfStock: v.stock === 0,
        });
      }
    });
  });

  return alerts;
}
