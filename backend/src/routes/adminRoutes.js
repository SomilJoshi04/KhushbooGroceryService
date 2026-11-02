/**
 * Dedicated Admin Management Routes.
 *
 * All endpoints require authentication and ADMIN / SUPER_ADMIN role.
 *
 * @module routes/adminRoutes
 */

import express from 'express';
import {
  getDashboardStats,
  getAllOrders,
  updateOrderStatus,
  bulkUpdateOrderStatus,
  getAdminProducts,
  bulkUpdateProductStatus,
  bulkDeleteProducts,
  getAllCustomers,
  suspendCustomer,
  restoreCustomer,
  deleteCustomer,
  toggleCustomerStatus,
  getDeletionRequests,
  processDeletionRequest,
  bulkSuspendCustomers,
  bulkRestoreCustomers,
  bulkDeleteCustomers,
  updateProductStock,
  getInventory,
  bulkAdjustStock,
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  bulkUpdateCouponStatus,
  bulkDeleteCoupons,
  getStoreSettings,
  updateStoreSettings,
  getReports,
  getAdminProfile,
  updateAdminProfile,
} from '../controllers/adminController.js';
import {
  getAllZones,
  getZoneById,
  createZone,
  updateZone,
  toggleZonePause,
  toggleZoneStatus,
  deleteZone,
  bulkUpdateZoneStatus,
  bulkDeleteZones,
} from '../controllers/zoneController.js';
import {
  getAdminPrivacyPolicy,
  updatePrivacyPolicyDraft,
  publishPrivacyPolicy,
  getAdminTerms,
  updateTermsDraft,
  publishTerms,
  getAdminFaqs,
  createFaq,
  updateFaq,
  deleteFaq,
  bulkUpdateFaqStatus,
  bulkDeleteFaqs,
  getAdminSupportSettings,
  updateSupportSettings,
  getAdminInquiries,
  updateInquiryStatus,
  rejectInquiry,
  deleteInquiry,
  addInquiryNote,
  bulkUpdateInquiryStatus,
  bulkRejectInquiries,
  bulkDeleteInquiries,
} from '../controllers/contentController.js';
import {
  getAdminBanners,
  getAdminBannerById,
  createBanner,
  updateBanner,
  toggleBannerStatus,
  duplicateBanner,
  reorderBanners,
  deleteBanner,
  bulkUpdateBannerStatus,
  bulkDeleteBanners,
} from '../controllers/bannerController.js';
import { validate } from '../middleware/validate.js';
import {
  createBannerSchema,
  updateBannerSchema,
  reorderBannersSchema,
} from '../validation/bannerSchemas.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Strict RBAC Guard on all administrative routes
router.use(requireAuth, requireRole('ADMIN', 'SUPER_ADMIN'));

// Dashboard Overview
router.get('/dashboard', getDashboardStats);

// Orders Management
router.get('/orders', getAllOrders);
router.patch('/orders/:id/status', updateOrderStatus);
router.post('/orders/bulk-status', bulkUpdateOrderStatus);

// Customer Accounts (Suspend, Restore, Safe Deletion & Anonymization, Bulk Actions)
router.get('/customers', getAllCustomers);
router.get('/customers/deletion-requests', getDeletionRequests);
router.post('/customers/:id/deletion-request', processDeletionRequest);
router.post('/customers/:id/suspend', suspendCustomer);
router.post('/customers/:id/restore', restoreCustomer);
router.delete('/customers/:id', deleteCustomer);
router.patch('/customers/:id/status', toggleCustomerStatus);
router.post('/customers/bulk-suspend', bulkSuspendCustomers);
router.post('/customers/bulk-restore', bulkRestoreCustomers);
router.post('/customers/bulk-delete', bulkDeleteCustomers);

// Delivery Zone Management (Full CRUD, Overlaps, Pause with reason, Distance Pricing, Bulk)
router.get('/zones', getAllZones);
router.get('/zones/:id', getZoneById);
router.post('/zones', createZone);
router.put('/zones/:id', updateZone);
router.patch('/zones/:id', updateZone);
router.patch('/zones/:id/pause', toggleZonePause);
router.patch('/zones/:id/status', toggleZoneStatus);
router.delete('/zones/:id', deleteZone);
router.post('/zones/bulk-status', bulkUpdateZoneStatus);
router.post('/zones/bulk-delete', bulkDeleteZones);

// Content Management: Privacy Policy
router.get('/content/privacy-policy', getAdminPrivacyPolicy);
router.put('/content/privacy-policy/draft', updatePrivacyPolicyDraft);
router.post('/content/privacy-policy/publish', publishPrivacyPolicy);

// Content Management: Terms & Conditions
router.get('/content/terms', getAdminTerms);
router.put('/content/terms/draft', updateTermsDraft);
router.post('/content/terms/publish', publishTerms);

// Content Management: FAQs & Bulk Actions
router.get('/content/faqs', getAdminFaqs);
router.post('/content/faqs', createFaq);
router.patch('/content/faqs/:id', updateFaq);
router.delete('/content/faqs/:id', deleteFaq);
router.post('/content/faqs/bulk-status', bulkUpdateFaqStatus);
router.post('/content/faqs/bulk-delete', bulkDeleteFaqs);

// Content Management: Help & Support Settings, Inquiry Lifecycle & Bulk Actions
router.get('/content/support', getAdminSupportSettings);
router.put('/content/support', updateSupportSettings);
router.get('/content/inquiries', getAdminInquiries);
router.patch('/content/inquiries/:id/status', updateInquiryStatus);
router.post('/content/inquiries/:id/reject', rejectInquiry);
router.delete('/content/inquiries/:id', deleteInquiry);
router.post('/content/inquiries/:id/notes', addInquiryNote);
router.post('/content/inquiries/bulk-status', bulkUpdateInquiryStatus);
router.post('/content/inquiries/bulk-reject', bulkRejectInquiries);
router.post('/content/inquiries/bulk-delete', bulkDeleteInquiries);

// Promotional Banners Management & Bulk Actions
router.get('/banners', getAdminBanners);
router.post('/banners', validate({ body: createBannerSchema }), createBanner);
router.put('/banners/reorder', validate({ body: reorderBannersSchema }), reorderBanners);
router.get('/banners/:id', getAdminBannerById);
router.put('/banners/:id', validate({ body: updateBannerSchema }), updateBanner);
router.patch('/banners/:id/status', toggleBannerStatus);
router.post('/banners/:id/duplicate', duplicateBanner);
router.delete('/banners/:id', deleteBanner);
router.post('/banners/bulk-status', bulkUpdateBannerStatus);
router.post('/banners/bulk-delete', bulkDeleteBanners);

// Products & Variants Management & Bulk Actions
router.get('/products', getAdminProducts);
router.post('/products/bulk-status', bulkUpdateProductStatus);
router.post('/products/bulk-delete', bulkDeleteProducts);

// Inventory & Stock & Bulk Actions
router.get('/inventory', getInventory);
router.patch('/products/:id/stock', updateProductStock);
router.post('/inventory/bulk-adjust', bulkAdjustStock);

// Coupons Management & Bulk Actions
router.get('/coupons', getCoupons);
router.post('/coupons', createCoupon);
router.patch('/coupons/:id', updateCoupon);
router.delete('/coupons/:id', deleteCoupon);
router.post('/coupons/bulk-status', bulkUpdateCouponStatus);
router.post('/coupons/bulk-delete', bulkDeleteCoupons);

// Store & Delivery Settings
router.get('/settings', getStoreSettings);
router.put('/settings', updateStoreSettings);

// Reports & Statistics
router.get('/reports', getReports);

// Admin Profile
router.get('/profile', getAdminProfile);
router.patch('/profile', updateAdminProfile);

export default router;
