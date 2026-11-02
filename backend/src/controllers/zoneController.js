/**
 * Zone Management Controller — Full CRUD, Serviceability, and Overlap Prevention.
 *
 * Implements:
 * - Pagination, search, and status filters.
 * - Validation of coordinates, radius, code uniqueness, and fee thresholds.
 * - Soft-deletion when orders or customer addresses reference the zone.
 * - Audit logging of all zone creations, updates, suspensions, and deletions.
 *
 * @module controllers/zoneController
 */

import { DeliveryZone } from '../models/DeliveryZone.js';
import { StoreSetting } from '../models/StoreSetting.js';
import { Order } from '../models/Order.js';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';
import { ensureDefaultZonesExist, calculateEstimatedRoadDistanceKm } from '../services/deliveryService.js';
import { parsePaginationParams, formatPaginatedResponse } from '../utils/pagination.js';
import { executeBulkOperation } from '../utils/bulkOperations.js';

/**
 * GET /api/v1/admin/zones
 * Retrieves paginated, filterable delivery zones.
 */
export async function getAllZones(req, res, next) {
  try {
    await ensureDefaultZonesExist();

    const { page, limit, skip, sortObj } = parsePaginationParams(req.query, {
      defaultLimit: 10,
      maxLimit: 100,
      allowedSortFields: ['createdAt', 'name', 'code', 'city', 'updatedAt'],
      defaultSortBy: 'createdAt',
      defaultSortOrder: 'desc',
    });

    const { search, status, city } = req.query;

    const filter = { isDeleted: false };

    if (city && city.trim()) {
      filter.city = new RegExp(city.trim(), 'i');
    }

    if (status === 'ACTIVE') {
      filter.isActive = true;
      filter.isPaused = false;
    } else if (status === 'INACTIVE') {
      filter.isActive = false;
    } else if (status === 'PAUSED') {
      filter.isPaused = true;
    }

    if (search && search.trim()) {
      const escaped = search.trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      filter.$or = [
        { name: regex },
        { code: regex },
        { city: regex },
        { supportedPincodes: regex },
        { description: regex },
      ];
    }

    const [zones, total] = await Promise.all([
      DeliveryZone.find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email')
        .lean(),
      DeliveryZone.countDocuments(filter),
    ]);

    // Check order references for deletion safeguard hints
    const zoneIds = zones.map((z) => z._id);
    const orderCounts = await Order.aggregate([
      { $match: { 'deliverySnapshot.zoneId': { $in: zoneIds } } },
      { $group: { _id: '$deliverySnapshot.zoneId', count: { $sum: 1 } } },
    ]);

    const orderCountMap = new Map();
    orderCounts.forEach((oc) => orderCountMap.set(oc._id.toString(), oc.count));

    const enrichedZones = zones.map((z) => ({
      ...z,
      referencedOrderCount: orderCountMap.get(z._id.toString()) || 0,
    }));

    return res.json(
      formatPaginatedResponse({
        req,
        data: enrichedZones,
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
 * GET /api/v1/admin/zones/:id
 * Retrieves full details for a single zone.
 */
export async function getZoneById(req, res, next) {
  try {
    const { id } = req.params;
    const zone = await DeliveryZone.findOne({ _id: id, isDeleted: false })
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!zone) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'Delivery zone not found.',
      });
    }

    const orderCount = await Order.countDocuments({ 'deliverySnapshot.zoneId': zone._id });

    res.json({
      success: true,
      requestId: req.id,
      data: {
        ...zone.toObject(),
        referencedOrderCount: orderCount,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Helper to check overlapping zones and generate informative warnings.
 */
async function checkZoneOverlaps(center, radiusKm, supportedPincodes, excludeZoneId = null) {
  const query = { isActive: true, isDeleted: false };
  if (excludeZoneId) {
    query._id = { $ne: excludeZoneId };
  }

  const existingZones = await DeliveryZone.find(query).lean();
  const warnings = [];

  for (const existing of existingZones) {
    // 1. PIN code overlap
    const commonPincodes = existing.supportedPincodes.filter((p) =>
      supportedPincodes.includes(p)
    );
    if (commonPincodes.length > 0) {
      warnings.push(
        `PIN codes (${commonPincodes.join(', ')}) overlap with active zone "${existing.name}" (${existing.code}). Deterministic priority scoring will resolve checkout queries.`
      );
    }

    // 2. Geographic radial overlap
    if (existing.center?.lat && existing.center?.lng && center?.lat && center?.lng) {
      const dist = calculateEstimatedRoadDistanceKm(
        existing.center.lat,
        existing.center.lng,
        center.lat,
        center.lng
      );
      const combinedRadius = (existing.radiusKm || 5) + (radiusKm || 5);
      if (dist < combinedRadius) {
        warnings.push(
          `Geographic boundary overlaps with active zone "${existing.name}" (${existing.code}) — centers are ${(dist / 1.35).toFixed(1)} km apart.`
        );
      }
    }
  }

  return warnings;
}

/**
 * POST /api/v1/admin/zones
 * Creates a new delivery zone.
 */
export async function createZone(req, res, next) {
  try {
    const {
      name,
      code,
      description,
      city = 'Indore',
      state = 'Madhya Pradesh',
      supportedPincodes,
      center,
      radiusKm,
      dispatchLocation,
      minOrderAmountPaise = 15000,
      freeDeliveryThresholdPaise = 49900,
      deliveryFeeBasePaise = 2500,
      distanceTierPaisePerKm = 500,
      maxDeliveryDistanceKm = 15,
      estimatedDeliveryWindow = '90 - 120 Minutes',
      isActive = true,
      priority = 1,
    } = req.body;

    // Field Validations
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Zone name is required.' });
    }

    if (!code || !code.trim()) {
      return res.status(400).json({ success: false, message: 'Zone code is required.' });
    }

    const cleanCode = code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,25}$/.test(cleanCode)) {
      return res.status(400).json({
        success: false,
        message: 'Zone code must be 3-25 uppercase alphanumeric characters or dashes (e.g., IND-CENTRAL).',
      });
    }

    const existingCode = await DeliveryZone.findOne({ code: cleanCode, isDeleted: false });
    if (existingCode) {
      return res.status(400).json({
        success: false,
        message: `Zone code "${cleanCode}" is already in use by another zone.`,
      });
    }

    if (!Array.isArray(supportedPincodes) || supportedPincodes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one supported 6-digit Indian PIN code is required.',
      });
    }

    const cleanPincodes = supportedPincodes.map((p) => String(p).trim()).filter((p) => /^\d{6}$/.test(p));
    if (cleanPincodes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid 6-digit Indian PIN codes.',
      });
    }

    if (!center || typeof center.lat !== 'number' || typeof center.lng !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'Valid center coordinates (lat, lng) are required.',
      });
    }

    if (center.lat < -90 || center.lat > 90 || center.lng < -180 || center.lng > 180) {
      return res.status(400).json({
        success: false,
        message: 'Latitude must be between -90 and 90, and longitude between -180 and 180.',
      });
    }

    const radius = Number(radiusKm) || 5.0;
    if (radius <= 0 || radius > 50) {
      return res.status(400).json({
        success: false,
        message: 'Radius must be between 0.5 km and 50 km.',
      });
    }

    if (minOrderAmountPaise < 0 || freeDeliveryThresholdPaise < 0 || deliveryFeeBasePaise < 0) {
      return res.status(400).json({
        success: false,
        message: 'Pricing values cannot be negative.',
      });
    }

    // Check potential overlaps and generate advisory warnings
    const overlapWarnings = await checkZoneOverlaps(center, radius, cleanPincodes);

    const newZone = await DeliveryZone.create({
      name: name.trim(),
      code: cleanCode,
      description: description ? description.trim() : '',
      city: city.trim(),
      state: state.trim(),
      supportedPincodes: cleanPincodes,
      center: { lat: center.lat, lng: center.lng },
      radiusKm: radius,
      dispatchLocation: dispatchLocation || {
        name: 'Indore Central Hub',
        address: 'MG Road, Geeta Bhawan, Indore, MP 452001',
        lat: 22.7196,
        lng: 75.8577,
      },
      minOrderAmountPaise: Number(minOrderAmountPaise),
      freeDeliveryThresholdPaise: Number(freeDeliveryThresholdPaise),
      deliveryFeeBasePaise: Number(deliveryFeeBasePaise),
      distanceTierPaisePerKm: Number(distanceTierPaisePerKm),
      maxDeliveryDistanceKm: Number(maxDeliveryDistanceKm),
      estimatedDeliveryWindow: estimatedDeliveryWindow.trim(),
      isActive: Boolean(isActive),
      priority: Number(priority) || 1,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    await AuditLog.create({
      action: 'ZONE_CREATE',
      performedBy: req.user._id,
      performerRole: req.user.role,
      targetType: 'DeliveryZone',
      targetId: newZone._id.toString(),
      details: { code: cleanCode, name: newZone.name, city: newZone.city },
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    res.status(201).json({
      success: true,
      requestId: req.id,
      message: `Delivery zone "${newZone.name}" created successfully.`,
      zone: newZone,
      overlapWarnings,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/admin/zones/:id
 * Updates an existing delivery zone.
 */
export async function updateZone(req, res, next) {
  try {
    const { id } = req.params;
    const zone = await DeliveryZone.findOne({ _id: id, isDeleted: false });

    if (!zone) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'Delivery zone not found.',
      });
    }

    const {
      name,
      code,
      description,
      city,
      state,
      supportedPincodes,
      center,
      radiusKm,
      dispatchLocation,
      minOrderAmountPaise,
      freeDeliveryThresholdPaise,
      deliveryFeeBasePaise,
      distanceTierPaisePerKm,
      maxDeliveryDistanceKm,
      estimatedDeliveryWindow,
      isActive,
      priority,
    } = req.body;

    if (code) {
      const cleanCode = code.trim().toUpperCase();
      if (!/^[A-Z0-9_-]{3,25}$/.test(cleanCode)) {
        return res.status(400).json({
          success: false,
          message: 'Zone code must be 3-25 uppercase alphanumeric characters.',
        });
      }
      if (cleanCode !== zone.code) {
        const existing = await DeliveryZone.findOne({ code: cleanCode, _id: { $ne: zone._id }, isDeleted: false });
        if (existing) {
          return res.status(400).json({
            success: false,
            message: `Zone code "${cleanCode}" is already in use by another zone.`,
          });
        }
        zone.code = cleanCode;
      }
    }

    if (name) zone.name = name.trim();
    if (description !== undefined) zone.description = description.trim();
    if (city) zone.city = city.trim();
    if (state) zone.state = state.trim();

    if (supportedPincodes) {
      const cleanPincodes = supportedPincodes.map((p) => String(p).trim()).filter((p) => /^\d{6}$/.test(p));
      if (cleanPincodes.length === 0) {
        return res.status(400).json({ success: false, message: 'At least one valid PIN code is required.' });
      }
      zone.supportedPincodes = cleanPincodes;
    }

    if (center && typeof center.lat === 'number' && typeof center.lng === 'number') {
      zone.center = { lat: center.lat, lng: center.lng };
    }

    if (radiusKm !== undefined) {
      const r = Number(radiusKm);
      if (r <= 0 || r > 50) {
        return res.status(400).json({ success: false, message: 'Radius must be between 0.5 km and 50 km.' });
      }
      zone.radiusKm = r;
    }

    if (dispatchLocation) zone.dispatchLocation = dispatchLocation;
    if (minOrderAmountPaise !== undefined) zone.minOrderAmountPaise = Math.max(0, Number(minOrderAmountPaise));
    if (freeDeliveryThresholdPaise !== undefined) zone.freeDeliveryThresholdPaise = Math.max(0, Number(freeDeliveryThresholdPaise));
    if (deliveryFeeBasePaise !== undefined) zone.deliveryFeeBasePaise = Math.max(0, Number(deliveryFeeBasePaise));
    if (distanceTierPaisePerKm !== undefined) zone.distanceTierPaisePerKm = Math.max(0, Number(distanceTierPaisePerKm));
    if (maxDeliveryDistanceKm !== undefined) zone.maxDeliveryDistanceKm = Math.max(1, Number(maxDeliveryDistanceKm));
    if (estimatedDeliveryWindow) zone.estimatedDeliveryWindow = estimatedDeliveryWindow.trim();
    if (isActive !== undefined) zone.isActive = Boolean(isActive);
    if (priority !== undefined) zone.priority = Number(priority);

    zone.updatedBy = req.user._id;
    await zone.save();

    // Also sync StoreSetting if minOrder, freeDelivery, or estimated window updated
    const storeSync = {};
    if (zone.minOrderAmountPaise !== undefined) storeSync.minOrderAmountPaise = zone.minOrderAmountPaise;
    if (zone.freeDeliveryThresholdPaise !== undefined) storeSync.freeDeliveryThresholdPaise = zone.freeDeliveryThresholdPaise;
    if (zone.estimatedDeliveryWindow) storeSync.estimatedDeliveryWindow = zone.estimatedDeliveryWindow;
    if (Object.keys(storeSync).length > 0) {
      await StoreSetting.updateOne({}, { $set: storeSync }).catch(() => {});
    }

    const overlapWarnings = await checkZoneOverlaps(zone.center, zone.radiusKm, zone.supportedPincodes, zone._id);

    await AuditLog.create({
      action: 'ZONE_UPDATE',
      performedBy: req.user._id,
      performerRole: req.user.role,
      targetType: 'DeliveryZone',
      targetId: zone._id.toString(),
      details: { code: zone.code, name: zone.name, isActive: zone.isActive },
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    res.json({
      success: true,
      requestId: req.id,
      message: `Delivery zone "${zone.name}" updated successfully.`,
      zone,
      overlapWarnings,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/admin/zones/:id/pause
 * Toggles temporary service suspension for a zone with mandatory reason when pausing.
 */
export async function toggleZonePause(req, res, next) {
  try {
    const { id } = req.params;
    const { isPaused, pauseReason } = req.body;

    const zone = await DeliveryZone.findOne({ _id: id, isDeleted: false });
    if (!zone) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'Delivery zone not found.',
      });
    }

    const willPause = Boolean(isPaused);
    if (willPause && (!pauseReason || !pauseReason.trim())) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'A pause reason is required to explain temporary service suspension to customers.',
      });
    }

    zone.isPaused = willPause;
    zone.pauseReason = willPause ? pauseReason.trim() : '';
    zone.updatedBy = req.user._id;
    await zone.save();

    await AuditLog.create({
      action: willPause ? 'ZONE_PAUSE' : 'ZONE_RESUME',
      performedBy: req.user._id,
      performerRole: req.user.role,
      targetType: 'DeliveryZone',
      targetId: zone._id.toString(),
      details: { code: zone.code, name: zone.name, isPaused: willPause, pauseReason: zone.pauseReason },
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    res.json({
      success: true,
      requestId: req.id,
      message: willPause
        ? `Delivery for "${zone.name}" has been temporarily paused.`
        : `Delivery for "${zone.name}" has been resumed.`,
      zone,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/admin/zones/:id/status
 * Activates or deactivates a delivery zone.
 */
export async function toggleZoneStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const zone = await DeliveryZone.findOne({ _id: id, isDeleted: false });
    if (!zone) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'Delivery zone not found.',
      });
    }

    zone.isActive = Boolean(isActive);
    zone.updatedBy = req.user._id;
    await zone.save();

    await AuditLog.create({
      action: zone.isActive ? 'ZONE_ACTIVATE' : 'ZONE_DEACTIVATE',
      performedBy: req.user._id,
      performerRole: req.user.role,
      targetType: 'DeliveryZone',
      targetId: zone._id.toString(),
      details: { code: zone.code, name: zone.name, isActive: zone.isActive },
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    res.json({
      success: true,
      requestId: req.id,
      message: zone.isActive
        ? `Zone "${zone.name}" is now active.`
        : `Zone "${zone.name}" has been deactivated.`,
      zone,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/admin/zones/:id
 * Safely deletes a delivery zone.
 * If historical orders or customer addresses reference it, performs a protected soft-delete.
 */
export async function deleteZone(req, res, next) {
  try {
    const { id } = req.params;
    const zone = await DeliveryZone.findOne({ _id: id, isDeleted: false });

    if (!zone) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'Delivery zone not found or already deleted.',
      });
    }

    // Check references in historical orders
    const orderCount = await Order.countDocuments({ 'deliverySnapshot.zoneId': zone._id });
    const addressCount = await User.countDocuments({ 'addresses.zoneId': zone._id });

    let mode = 'SOFT_DELETE';
    if (orderCount > 0 || addressCount > 0) {
      // Soft deletion to protect historical order pricing and audit records
      zone.isDeleted = true;
      zone.isActive = false;
      zone.updatedBy = req.user._id;
      await zone.save();
    } else {
      // If 0 historical orders and 0 saved addresses reference it, hard purge is safe
      await DeliveryZone.deleteOne({ _id: zone._id });
      mode = 'HARD_PURGE';
    }

    await AuditLog.create({
      action: 'ZONE_DELETE',
      performedBy: req.user._id,
      performerRole: req.user.role,
      targetType: 'DeliveryZone',
      targetId: zone._id.toString(),
      details: {
        code: zone.code,
        name: zone.name,
        mode,
        referencedOrders: orderCount,
        referencedAddresses: addressCount,
      },
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    res.json({
      success: true,
      requestId: req.id,
      mode,
      message:
        mode === 'SOFT_DELETE'
          ? `Zone "${zone.name}" was deactivated and archived (preserved because ${orderCount} orders and ${addressCount} addresses reference it).`
          : `Zone "${zone.name}" was permanently deleted (0 historical references).`,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/zones/bulk-status
 * Bulk activates, pauses, or deactivates delivery zones.
 */
export async function bulkUpdateZoneStatus(req, res, next) {
  try {
    const { ids, selectAllMatching, filter, action, reason } = req.body;

    if (!['ACTIVATE', 'PAUSE', 'DEACTIVATE'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Valid action must be ACTIVATE, PAUSE, or DEACTIVATE.',
      });
    }

    const baseFilter = { isDeleted: false };
    const result = await executeBulkOperation({
      req,
      model: DeliveryZone,
      ids,
      selectAllMatching,
      filter: baseFilter,
      actionName: `BULK_ZONE_${action}`,
      entityName: 'DeliveryZone',
      context: { action, reason },
      handler: async (doc, ctx) => {
        if (ctx.action === 'ACTIVATE') {
          doc.isActive = true;
          doc.isPaused = false;
          doc.pauseReason = '';
        } else if (ctx.action === 'PAUSE') {
          doc.isActive = true;
          doc.isPaused = true;
          doc.pauseReason = ctx.reason || 'Temporarily paused via bulk management.';
        } else if (ctx.action === 'DEACTIVATE') {
          doc.isActive = false;
          doc.isPaused = false;
        }

        doc.updatedBy = ctx.adminId;
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
 * POST /api/v1/admin/zones/bulk-delete
 * Bulk deletes zones safely: archives if orders/addresses reference it; purges if 0 references.
 */
export async function bulkDeleteZones(req, res, next) {
  try {
    const { ids, selectAllMatching, filter } = req.body;

    const baseFilter = { isDeleted: false };
    const result = await executeBulkOperation({
      req,
      model: DeliveryZone,
      ids,
      selectAllMatching,
      filter: baseFilter,
      actionName: 'BULK_ZONE_DELETE',
      entityName: 'DeliveryZone',
      handler: async (doc, ctx) => {
        if (doc.isDeleted) {
          return { status: 'skipped', reason: 'Zone already deleted.' };
        }

        const orderCount = await Order.countDocuments({ 'deliverySnapshot.zoneId': doc._id });
        const addressCount = await User.countDocuments({ 'addresses.zoneId': doc._id });

        if (orderCount > 0 || addressCount > 0) {
          // Soft deletion to protect historical order pricing and audit records
          doc.isDeleted = true;
          doc.isActive = false;
          doc.updatedBy = ctx.adminId;
          await doc.save();
          return {
            status: 'skipped',
            reason: `Referenced by ${orderCount} orders and ${addressCount} saved addresses. Deactivated & archived instead of purged.`,
          };
        }

        await DeliveryZone.deleteOne({ _id: doc._id });
        return { status: 'success', note: 'Permanently deleted (0 historical references)' };
      },
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

