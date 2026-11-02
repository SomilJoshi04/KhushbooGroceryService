/**
 * Cart Controller — Authoritative Server-Side Cart Management & Validation.
 *
 * Implements:
 * - Strict customer authentication guard (all cart operations tied to verified req.user._id)
 * - Persistent customer cart in MongoDB (survives browser refresh, cross-device login)
 * - Server-authoritative product & variant identity lookup
 * - Real-time stock validation & clamping against live inventory
 * - Server-side price recalculation (never trusts client totals or pricing)
 * - Safe handling of deactivated or discontinued products/variants
 * - Immediate stock / price change notifications
 *
 * @module controllers/cartController
 */

import { Product } from '../models/Product.js';

/**
 * Calculates cart summary totals in integer paise.
 */
function calculateCartTotals(items = []) {
  let subtotalPaise = 0;
  let savingsPaise = 0;
  let itemCount = 0;

  for (const item of items) {
    const qty = Math.max(0, Number(item.qty) || 0);
    const price = Math.max(0, Number(item.pricePaise) || 0);
    const mrp = Math.max(price, Number(item.mrpPaise) || price);

    subtotalPaise += price * qty;
    savingsPaise += (mrp - price) * qty;
    itemCount += qty;
  }

  return { subtotalPaise, savingsPaise, itemCount };
}

/**
 * GET /api/v1/cart
 * Retrieves the authenticated customer's cart, revalidated against live inventory.
 */
export async function getCart(req, res, next) {
  try {
    const user = req.user;
    const warnings = [];
    const validItems = [];

    // Revalidate each stored item against live catalog
    for (const item of user.cart || []) {
      const product = await Product.findById(item.productId).lean();

      if (!product || !product.isPublished) {
        warnings.push(`"${item.name}" is no longer available and was removed from your cart.`);
        continue;
      }

      const variant = product.variants?.find(
        (v) =>
          (item.variantSku && v.sku === item.variantSku) ||
          (item.variantId && v._id.toString() === item.variantId.toString()) ||
          (item.variantLabel && v.label === item.variantLabel)
      );

      if (!variant || !variant.isActive) {
        warnings.push(`The selected pack size for "${product.name}" is no longer available.`);
        continue;
      }

      const availableStock = Math.max(0, Number(variant.stock) || 0);
      if (availableStock <= 0) {
        warnings.push(`"${product.name} (${variant.label})" is out of stock.`);
        continue;
      }

      let confirmedQty = item.qty;
      if (confirmedQty > availableStock) {
        confirmedQty = availableStock;
        warnings.push(
          `Quantity for "${product.name} (${variant.label})" adjusted to ${availableStock} units due to available stock.`
        );
      }

      if (variant.pricePaise !== item.pricePaise) {
        warnings.push(
          `Price for "${product.name} (${variant.label})" updated to ₹${(variant.pricePaise / 100).toFixed(0)}.`
        );
      }

      validItems.push({
        _id: item._id,
        cartKey: item.cartKey || `${product._id}::${variant._id || variant.sku}`,
        productId: product._id,
        variantId: variant._id.toString(),
        variantSku: variant.sku || '',
        variantLabel: variant.label || 'Standard Pack',
        name: product.name,
        brand: product.brand || 'Khushboo Pure',
        image: product.images?.[0] || item.image || '',
        pricePaise: variant.pricePaise,
        mrpPaise: variant.mrpPaise || variant.pricePaise,
        weightGrams: variant.weightGrams || 500,
        stock: availableStock,
        qty: confirmedQty,
      });
    }

    // Persist revalidated cart if changes occurred
    user.cart = validItems;
    await user.save();

    const totals = calculateCartTotals(validItems);

    res.json({
      success: true,
      requestId: req.id,
      cart: validItems,
      ...totals,
      warnings,
      canCheckout: validItems.length > 0 && totals.subtotalPaise > 0,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/cart/items
 * Adds a product variant or increments quantity in the authenticated customer's cart.
 */
export async function addItemToCart(req, res, next) {
  try {
    const { productId, variantId, sku, quantity = 1 } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'Product ID is required.',
      });
    }

    const qtyToAdd = parseInt(quantity, 10);
    if (isNaN(qtyToAdd) || qtyToAdd < 1) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'Quantity must be a positive integer greater than zero.',
      });
    }

    const product = await Product.findById(productId).lean();
    if (!product || !product.isPublished) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'Product not found or is currently inactive.',
      });
    }

    const variant = product.variants?.find(
      (v) =>
        (sku && v.sku === sku) ||
        (variantId && v._id.toString() === variantId.toString())
    ) || product.variants?.[0];

    if (!variant || !variant.isActive) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'The selected product variant / pack size is currently unavailable.',
      });
    }

    const availableStock = Math.max(0, Number(variant.stock) || 0);
    if (availableStock <= 0) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: `"${product.name} (${variant.label})" is currently out of stock.`,
      });
    }

    const user = req.user;
    const cartKey = `${product._id}::${variant._id || variant.sku || variant.label}`;

    const existingIndex = (user.cart || []).findIndex(
      (item) =>
        item.cartKey === cartKey ||
        (item.productId.toString() === product._id.toString() &&
          ((variant.sku && item.variantSku === variant.sku) ||
            (variant._id && item.variantId === variant._id.toString())))
    );

    let resultingQty = 0;
    let hitMax = false;

    if (existingIndex > -1) {
      const existing = user.cart[existingIndex];
      const targetQty = existing.qty + qtyToAdd;

      if (targetQty > availableStock) {
        resultingQty = availableStock;
        hitMax = true;
      } else {
        resultingQty = targetQty;
      }

      user.cart[existingIndex].qty = resultingQty;
      user.cart[existingIndex].pricePaise = variant.pricePaise;
      user.cart[existingIndex].mrpPaise = variant.mrpPaise || variant.pricePaise;
      user.cart[existingIndex].stock = availableStock;
      user.cart[existingIndex].cartKey = cartKey;
    } else {
      resultingQty = Math.min(qtyToAdd, availableStock);
      if (qtyToAdd > availableStock) {
        hitMax = true;
      }

      user.cart.push({
        cartKey,
        productId: product._id,
        variantId: variant._id.toString(),
        variantSku: variant.sku || '',
        variantLabel: variant.label || 'Standard Pack',
        name: product.name,
        brand: product.brand || 'Khushboo Pure',
        image: product.images?.[0] || '',
        pricePaise: variant.pricePaise,
        mrpPaise: variant.mrpPaise || variant.pricePaise,
        weightGrams: variant.weightGrams || 500,
        stock: availableStock,
        qty: resultingQty,
      });
    }

    await user.save();
    const totals = calculateCartTotals(user.cart);

    res.json({
      success: true,
      requestId: req.id,
      message: hitMax
        ? `Added maximum available stock (${availableStock} units) for ${product.name}.`
        : `Added ${product.name} (${variant.label}) to your cart.`,
      cart: user.cart,
      newQty: resultingQty,
      hitMax,
      ...totals,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/cart/items/:itemKey
 * Updates quantity (+/- delta or direct set) for a cart item.
 */
export async function updateCartItemQty(req, res, next) {
  try {
    const { itemKey } = req.params;
    const { delta, quantity } = req.body;

    const user = req.user;
    const itemIndex = (user.cart || []).findIndex(
      (item) =>
        item.cartKey === itemKey ||
        item.variantSku === itemKey ||
        item.variantId === itemKey ||
        item._id?.toString() === itemKey
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'Item not found in your cart.',
      });
    }

    const currentItem = user.cart[itemIndex];
    let targetQty = currentItem.qty;

    if (quantity !== undefined) {
      targetQty = parseInt(quantity, 10);
    } else if (delta !== undefined) {
      targetQty = currentItem.qty + parseInt(delta, 10);
    } else {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'Either "delta" or "quantity" must be provided.',
      });
    }

    // Removal if reduced to 0 or less
    if (isNaN(targetQty) || targetQty <= 0) {
      user.cart.splice(itemIndex, 1);
      await user.save();
      const totals = calculateCartTotals(user.cart);
      return res.json({
        success: true,
        requestId: req.id,
        message: 'Item removed from cart.',
        cart: user.cart,
        newQty: 0,
        ...totals,
      });
    }

    // Live inventory check for increment
    const product = await Product.findById(currentItem.productId).lean();
    const variant = product?.variants?.find(
      (v) =>
        (currentItem.variantSku && v.sku === currentItem.variantSku) ||
        (currentItem.variantId && v._id.toString() === currentItem.variantId.toString())
    );

    let hitMax = false;
    const availableStock = Math.max(0, Number(variant?.stock) || 0);

    if (availableStock <= 0) {
      user.cart.splice(itemIndex, 1);
      await user.save();
      const totals = calculateCartTotals(user.cart);
      return res.json({
        success: false,
        requestId: req.id,
        message: 'Item is now out of stock and was removed from your cart.',
        cart: user.cart,
        newQty: 0,
        ...totals,
      });
    }

    if (targetQty > availableStock) {
      targetQty = availableStock;
      hitMax = true;
    }

    user.cart[itemIndex].qty = targetQty;
    if (variant) {
      user.cart[itemIndex].pricePaise = variant.pricePaise;
      user.cart[itemIndex].mrpPaise = variant.mrpPaise || variant.pricePaise;
      user.cart[itemIndex].stock = availableStock;
    }

    await user.save();
    const totals = calculateCartTotals(user.cart);

    res.json({
      success: true,
      requestId: req.id,
      message: hitMax ? 'Maximum available stock reached.' : 'Cart updated.',
      cart: user.cart,
      newQty: targetQty,
      hitMax,
      ...totals,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/cart/items/:itemKey
 * Removes an item from the customer's cart.
 */
export async function removeCartItem(req, res, next) {
  try {
    const { itemKey } = req.params;
    const user = req.user;

    const initialLen = (user.cart || []).length;
    user.cart = user.cart.filter(
      (item) =>
        item.cartKey !== itemKey &&
        item.variantSku !== itemKey &&
        item.variantId !== itemKey &&
        item._id?.toString() !== itemKey
    );

    if (user.cart.length === initialLen) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'Item not found in your cart.',
      });
    }

    await user.save();
    const totals = calculateCartTotals(user.cart);

    res.json({
      success: true,
      requestId: req.id,
      message: 'Item removed from your cart.',
      cart: user.cart,
      ...totals,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/cart
 * Clears the customer's active cart.
 */
export async function clearCart(req, res, next) {
  try {
    const user = req.user;
    user.cart = [];
    await user.save();

    res.json({
      success: true,
      requestId: req.id,
      message: 'Cart cleared successfully.',
      cart: [],
      subtotalPaise: 0,
      savingsPaise: 0,
      itemCount: 0,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/cart/validate
 * Validates an array of items or authenticated customer's cart against live catalog.
 */
export async function validateCart(req, res, next) {
  try {
    const user = req.user;
    const items = req.body?.items || user.cart || [];

    if (!Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'Invalid request: "items" must be an array.',
      });
    }

    const validatedItems = [];
    let subtotalPaise = 0;
    let savingsPaise = 0;
    const warnings = [];
    let allAvailable = true;

    for (const clientItem of items) {
      const { productId, sku, variantId, quantity = 1, pricePaise: clientPrice } = clientItem;

      if (!productId) continue;

      const product = await Product.findById(productId).lean();
      if (!product || !product.isPublished) {
        allAvailable = false;
        warnings.push(`Item "${clientItem.name || 'Product'}" is no longer available.`);
        continue;
      }

      const variant = product.variants?.find(
        (v) => (sku && v.sku === sku) || (variantId && v._id.toString() === variantId.toString())
      );

      if (!variant || !variant.isActive) {
        allAvailable = false;
        warnings.push(`Selected pack size for "${product.name}" is no longer available.`);
        continue;
      }

      const availableStock = Math.max(0, Number(variant.stock) || 0);
      const reqQty = Math.max(1, Number(quantity) || 1);

      let confirmedQty = reqQty;
      let itemStatus = 'OK';
      let itemMessage = '';

      if (availableStock <= 0) {
        allAvailable = false;
        confirmedQty = 0;
        itemStatus = 'OUT_OF_STOCK';
        itemMessage = `"${product.name} (${variant.label})" is currently out of stock.`;
        warnings.push(itemMessage);
      } else if (reqQty > availableStock) {
        allAvailable = false;
        confirmedQty = availableStock;
        itemStatus = 'QUANTITY_CLAMPED';
        itemMessage = `Only ${availableStock} units of "${product.name} (${variant.label})" available. Quantity adjusted.`;
        warnings.push(itemMessage);
      }

      if (clientPrice !== undefined && Number(clientPrice) !== variant.pricePaise) {
        if (itemStatus === 'OK') {
          itemStatus = 'PRICE_CHANGED';
          itemMessage = `Price for "${product.name} (${variant.label})" updated to ₹${(
            variant.pricePaise / 100
          ).toFixed(0)}.`;
          warnings.push(itemMessage);
        }
      }

      const lineSubtotal = variant.pricePaise * confirmedQty;
      const lineMrp = variant.mrpPaise * confirmedQty;

      subtotalPaise += lineSubtotal;
      savingsPaise += Math.max(0, lineMrp - lineSubtotal);

      validatedItems.push({
        productId: product._id,
        variantId: variant._id,
        sku: variant.sku,
        name: product.name,
        brand: product.brand || 'Khushboo Pure',
        variantLabel: variant.label,
        unit: variant.unit,
        image: product.images?.[0] || clientItem.image || '',
        weightGrams: variant.weightGrams,
        requestedQty: reqQty,
        confirmedQty,
        stock: availableStock,
        pricePaise: variant.pricePaise,
        mrpPaise: variant.mrpPaise,
        subtotalPaise: lineSubtotal,
        status: itemStatus,
        message: itemMessage,
      });
    }

    res.json({
      success: true,
      requestId: req.id,
      valid: allAvailable && validatedItems.length > 0,
      canCheckout: allAvailable && validatedItems.length > 0 && subtotalPaise > 0,
      subtotalPaise,
      savingsPaise,
      warnings,
      items: validatedItems,
    });
  } catch (err) {
    next(err);
  }
}
