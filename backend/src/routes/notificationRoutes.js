/**
 * Notification Routes — REST API endpoints for customer & admin notifications.
 *
 * @module routes/notificationRoutes
 */

import express from 'express';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllRead,
  deleteNotification,
  clearReadNotifications,
} from '../controllers/notificationController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// All notification endpoints require authenticated session
router.use(requireAuth);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/mark-all-read', markAllRead);
router.patch('/:id/read', markAsRead);
router.delete('/clear-all', clearReadNotifications);
router.delete('/:id', deleteNotification);

export default router;

