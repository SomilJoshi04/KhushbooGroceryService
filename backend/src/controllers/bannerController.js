/**
 * Promotional Banner Controller — Storefront & Administrative Management.
 *
 * Implements:
 * - Public eligible banner fetching with date scheduling & priority ordering.
 * - Admin banner CRUD with search, status filtering, pagination, and duplication.
 * - Bulk deterministic reordering.
 * - Granular active/inactive toggling.
 * - Audit logging for all administrative events.
 *
 * @module controllers/bannerController
 */

import mongoose from 'mongoose';
import { Banner } from '../models/Banner.js';
import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';
import { deleteFile } from '../services/fileStorageService.js';
import {
  parsePaginationParams,
  buildPaginationMeta,
  formatPaginatedResponse,
} from '../utils/pagination.js';
import { executeBulkOperation } from '../utils/bulkOperations.js';
import { createNotification } from '../services/notificationService.js';

/**
 * GET /api/v1/banners
 * Public storefront endpoint: returns only currently active, published, and unexpired banners.
 */
export async function getPublicBanners(req, res, next) {
  try {
    const now = new Date();

    const query = {
      isActive: true,
      $and: [
        { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
        { $or: [{ endDate: null }, { endDate: { $gt: now } }] },
      ],
    };

    const banners = await Banner.find(query)
      .select('title subtitle badge desktopImage mobileImage buttonText buttonLink targetType targetId priority')
      .sort({ priority: -1, createdAt: -1 })
      .lean();

    // Cache header: short TTL with revalidation support
    res.set('Cache-Control', 'public, max-age=60, s-maxage=120');

    res.json({
      success: true,
      requestId: req.id,
      data: banners,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/banners
 * Administrative listing with pagination, search, and status filtering.
 */
export async function getAdminBanners(req, res, next) {
  try {
    const {
      search = '',
      status = 'all', // 'all' | 'active' | 'inactive' | 'scheduled' | 'expired'
    } = req.query;

    const { page, limit, skip } = parsePaginationParams(req.query, {
      defaultLimit: 10,
      maxLimit: 100,
    });

    const now = new Date();
    const filter = {};

    // Search filter across internal name, public title, and badge
    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { title: { $regex: escaped, $options: 'i' } },
        { badge: { $regex: escaped, $options: 'i' } },
      ];
    }

    // Status filter
    if (status === 'active') {
      filter.isActive = true;
      filter.$and = [
        { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
        { $or: [{ endDate: null }, { endDate: { $gt: now } }] },
      ];
    } else if (status === 'inactive') {
      filter.isActive = false;
    } else if (status === 'scheduled') {
      filter.isActive = true;
      filter.startDate = { $gt: now };
    } else if (status === 'expired') {
      filter.isActive = true;
      filter.endDate = { $lte: now };
    }

    const [banners, totalCount, totalActive, totalScheduled, totalExpired] = await Promise.all([
      Banner.find(filter)
        .populate('createdBy', 'name phone role')
        .populate('updatedBy', 'name phone role')
        .sort({ priority: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Banner.countDocuments(filter),
      Banner.countDocuments({
        isActive: true,
        $and: [
          { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
          { $or: [{ endDate: null }, { endDate: { $gt: now } }] },
        ],
      }),
      Banner.countDocuments({ isActive: true, startDate: { $gt: now } }),
      Banner.countDocuments({ isActive: true, endDate: { $lte: now } }),
    ]);

    // Enhance banners with dynamic runtime status
    const enhancedBanners = banners.map((b) => {
      let computedStatus = 'INACTIVE';
      if (b.isActive) {
        if (b.startDate && new Date(b.startDate) > now) {
          computedStatus = 'SCHEDULED';
        } else if (b.endDate && new Date(b.endDate) <= now) {
          computedStatus = 'EXPIRED';
        } else {
          computedStatus = 'ACTIVE';
        }
      }
      return {
        ...b,
        computedStatus,
      };
    });

    const pagination = buildPaginationMeta({ page, limit, totalRecords: totalCount });

    res.json({
      success: true,
      requestId: req.id,
      data: enhancedBanners,
      pagination,
      total: totalCount,
      page,
      totalPages: pagination.totalPages,
      meta: {
        page,
        limit,
        total: totalCount,
        totalPages: pagination.totalPages,
        stats: {
          totalActive,
          totalScheduled,
          totalExpired,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/banners/:id
 * Fetch single banner by ID for editing or inspection.
 */
export async function getAdminBannerById(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'Invalid banner ID format.',
      });
    }

    const banner = await Banner.findById(id)
      .populate('createdBy', 'name phone role')
      .populate('updatedBy', 'name phone role')
      .lean();

    if (!banner) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'Promotional banner not found.',
      });
    }

    res.json({
      success: true,
      requestId: req.id,
      data: banner,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/banners
 * Create a new promotional banner.
 */
export async function createBanner(req, res, next) {
  try {
    const banner = await Banner.create({
      ...req.body,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    await AuditLog.create({
      action: 'BANNER_CREATE',
      performedBy: req.user._id,
      performerRole: req.user.role,
      targetType: 'Banner',
      targetId: banner._id.toString(),
      details: {
        name: banner.name,
        title: banner.title,
        priority: banner.priority,
        isActive: banner.isActive,
      },
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    // Real-Time Notification: Notify customers of published active banner
    if (banner.isActive) {
      createNotification({
        recipientGroup: 'ALL_CUSTOMERS',
        type: 'BANNER_PUBLISHED',
        title: banner.title || 'Special Promotion!',
        message: banner.subtitle || 'Check out our latest seasonal grocery offer.',
        severity: 'INFO',
        category: 'MARKETING',
        targetType: 'Banner',
        targetId: banner._id,
        targetUrl: banner.buttonLink || '/',
        metadata: {
          bannerTitle: banner.title,
        },
        idempotencyKey: `banner_pub_${banner._id}`,
        actorId: req.user._id,
      }).catch((notifErr) => console.error('[notification] Banner published customer notify error:', notifErr.message));
    }

    res.status(201).json({
      success: true,
      requestId: req.id,
      message: 'Promotional banner created successfully.',
      data: banner,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/admin/banners/:id
 * Update an existing promotional banner.
 */
export async function updateBanner(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'Invalid banner ID format.',
      });
    }

    const banner = await Banner.findById(id);
    if (!banner) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'Promotional banner not found.',
      });
    }

    const oldDesktop = banner.desktopImage;
    const oldMobile = banner.mobileImage;

    // Apply allowed updates
    Object.assign(banner, req.body, { updatedBy: req.user._id });
    await banner.save();

    // Clean up replaced images safely if not shared
    const models = { Product, Category, Banner, User };
    if (oldDesktop && req.body.desktopImage && oldDesktop !== req.body.desktopImage && oldDesktop.startsWith('/uploads/')) {
      deleteFile(oldDesktop, { force: false, models }).catch(() => {});
    }
    if (oldMobile && req.body.mobileImage && oldMobile !== req.body.mobileImage && oldMobile.startsWith('/uploads/')) {
      deleteFile(oldMobile, { force: false, models }).catch(() => {});
    }

    await AuditLog.create({
      action: 'BANNER_UPDATE',
      performedBy: req.user._id,
      performerRole: req.user.role,
      targetType: 'Banner',
      targetId: banner._id.toString(),
      details: {
        name: banner.name,
        title: banner.title,
        priority: banner.priority,
        isActive: banner.isActive,
      },
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    res.json({
      success: true,
      requestId: req.id,
      message: 'Promotional banner updated successfully.',
      data: banner,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/admin/banners/:id/status
 * Toggle or set active/inactive status.
 */
export async function toggleBannerStatus(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'Invalid banner ID format.',
      });
    }

    const banner = await Banner.findById(id);
    if (!banner) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'Promotional banner not found.',
      });
    }

    const newStatus = typeof req.body.isActive === 'boolean' ? req.body.isActive : !banner.isActive;
    banner.isActive = newStatus;
    banner.updatedBy = req.user._id;
    await banner.save();

    await AuditLog.create({
      action: 'BANNER_STATUS_TOGGLE',
      performedBy: req.user._id,
      performerRole: req.user.role,
      targetType: 'Banner',
      targetId: banner._id.toString(),
      details: {
        name: banner.name,
        isActive: banner.isActive,
      },
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    res.json({
      success: true,
      requestId: req.id,
      message: `Banner ${banner.isActive ? 'activated' : 'deactivated'} successfully.`,
      data: banner,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/banners/:id/duplicate
 * Duplicate an existing banner for quick campaign creation.
 */
export async function duplicateBanner(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'Invalid banner ID format.',
      });
    }

    const source = await Banner.findById(id).lean();
    if (!source) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'Source banner not found.',
      });
    }

    // eslint-disable-next-line no-unused-vars
    const { _id, createdAt, updatedAt, __v, ...clonePayload } = source;

    const duplicated = await Banner.create({
      ...clonePayload,
      name: `${source.name} (Copy)`,
      isActive: false, // Default to inactive/draft so admin reviews before publishing
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    await AuditLog.create({
      action: 'BANNER_DUPLICATE',
      performedBy: req.user._id,
      performerRole: req.user.role,
      targetType: 'Banner',
      targetId: duplicated._id.toString(),
      details: {
        sourceId: id,
        name: duplicated.name,
      },
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    res.status(201).json({
      success: true,
      requestId: req.id,
      message: 'Banner duplicated as draft.',
      data: duplicated,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/admin/banners/reorder
 * Bulk reorder banner priorities.
 */
export async function reorderBanners(req, res, next) {
  try {
    const { items } = req.body; // Array of { id, priority }

    const operations = items.map((item) => ({
      updateOne: {
        filter: { _id: item.id },
        update: { $set: { priority: item.priority, updatedBy: req.user._id } },
      },
    }));

    await Banner.bulkWrite(operations);

    await AuditLog.create({
      action: 'BANNER_REORDER',
      performedBy: req.user._id,
      performerRole: req.user.role,
      targetType: 'Banner',
      details: { count: items.length },
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    res.json({
      success: true,
      requestId: req.id,
      message: 'Banner display priorities updated successfully.',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/admin/banners/:id
 * Delete a promotional banner.
 */
export async function deleteBanner(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'Invalid banner ID format.',
      });
    }

    const banner = await Banner.findById(id);
    if (!banner) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'Promotional banner not found.',
      });
    }

    const oldDesktop = banner.desktopImage;
    const oldMobile = banner.mobileImage;

    await banner.deleteOne();

    // Clean up banner images from disk if not shared
    const models = { Product, Category, Banner, User };
    if (oldDesktop && oldDesktop.startsWith('/uploads/')) {
      deleteFile(oldDesktop, { force: false, models }).catch(() => {});
    }
    if (oldMobile && oldMobile.startsWith('/uploads/')) {
      deleteFile(oldMobile, { force: false, models }).catch(() => {});
    }

    await AuditLog.create({
      action: 'BANNER_DELETE',
      performedBy: req.user._id,
      performerRole: req.user.role,
      targetType: 'Banner',
      targetId: id,
      details: {
        name: banner.name,
        title: banner.title,
      },
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    res.json({
      success: true,
      requestId: req.id,
      message: 'Promotional banner deleted successfully.',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/banners/bulk-status
 * Bulk activates or deactivates banners.
 */
export async function bulkUpdateBannerStatus(req, res, next) {
  try {
    const { ids, selectAllMatching, filter, isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'A boolean "isActive" parameter is required.',
      });
    }

    const baseFilter = {};
    const result = await executeBulkOperation({
      req,
      model: Banner,
      ids,
      selectAllMatching,
      filter: baseFilter,
      actionName: 'BULK_BANNER_STATUS_UPDATE',
      entityName: 'Banner',
      context: { targetStatus: isActive ? 'ACTIVE' : 'INACTIVE' },
      handler: async (doc) => {
        if (doc.isActive === isActive) {
          return { status: 'skipped', reason: `Banner is already ${isActive ? 'active' : 'inactive'}.` };
        }

        doc.isActive = isActive;
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
 * POST /api/v1/admin/banners/bulk-delete
 * Bulk deletes promotional banners.
 */
export async function bulkDeleteBanners(req, res, next) {
  try {
    const { ids, selectAllMatching, filter } = req.body;

    const baseFilter = {};
    const result = await executeBulkOperation({
      req,
      model: Banner,
      ids,
      selectAllMatching,
      filter: baseFilter,
      actionName: 'BULK_BANNER_DELETE',
      entityName: 'Banner',
      handler: async (doc) => {
        await Banner.deleteOne({ _id: doc._id });
        return { status: 'success' };
      },
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

