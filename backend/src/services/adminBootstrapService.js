/**
 * Admin Bootstrap Service.
 *
 * Provides safe, idempotent initialization of the initial administrative account.
 * Reads credentials strictly from validated environment configuration.
 * Never prints, exposes, or logs secrets.
 *
 * @module services/adminBootstrapService
 */

import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';

/**
 * Checks if an administrator account already exists in MongoDB.
 * If none exists, creates the initial SUPER_ADMIN account using validated env vars.
 * If an admin account exists, preserves it without modifying passwords or data.
 *
 * Handles concurrent startup instances gracefully (E11000 race condition).
 *
 * @returns {Promise<{ status: 'EXISTS' | 'CREATED' | 'CONCURRENT_EXISTS', role?: string, isActive?: boolean }>}
 */
export async function ensureInitialAdminBootstrap() {
  // Check for any existing administrative user (ADMIN or SUPER_ADMIN)
  const existingAdmin = await User.findOne({
    role: { $in: ['ADMIN', 'SUPER_ADMIN'] },
  });

  if (existingAdmin) {
    return {
      status: 'EXISTS',
      role: existingAdmin.role,
      isActive: existingAdmin.isActive,
    };
  }

  // Strictly read from validated environment variables
  const email = env.ADMIN_EMAIL;
  const rawPassword = env.ADMIN_PASSWORD;
  const phone = env.ADMIN_PHONE;

  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(rawPassword, salt);

  try {
    const superAdmin = await User.create({
      phone,
      email,
      name: 'Super Administrator',
      role: 'SUPER_ADMIN',
      password: hashedPassword,
      isActive: true,
    });

    await AuditLog.create({
      action: 'SUPER_ADMIN_BOOTSTRAP',
      performedBy: superAdmin._id,
      performerRole: 'SUPER_ADMIN',
      targetType: 'User',
      targetId: superAdmin._id.toString(),
      details: { role: 'SUPER_ADMIN' },
      ipAddress: '127.0.0.1 (SYSTEM)',
    });

    return {
      status: 'CREATED',
      role: superAdmin.role,
      isActive: superAdmin.isActive,
    };
  } catch (err) {
    if (err.code === 11000) {
      // Handled concurrent bootstrap race condition
      return { status: 'CONCURRENT_EXISTS' };
    }
    throw err;
  }
}

