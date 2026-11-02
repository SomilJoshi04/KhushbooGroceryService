/**
 * Administrator Bootstrap Script.
 *
 * Checks MongoDB for an existing administrator account.
 * If none exists, creates the initial SUPER_ADMIN using validated backend
 * environment variables (ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_PHONE).
 * If an admin already exists, exits safely without modifying accounts or passwords.
 *
 * Credentials are NEVER hardcoded or logged to the console.
 *
 * @module scripts/bootstrapAdmin
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { ensureInitialAdminBootstrap } from '../src/services/adminBootstrapService.js';

async function bootstrap() {
  console.info('[bootstrap] Starting administrator bootstrap check...');

  try {
    await mongoose.connect(env.MONGO_URI);
    console.info('[bootstrap] Connected to MongoDB.');

    const result = await ensureInitialAdminBootstrap();

    if (result.status === 'EXISTS') {
      console.info(
        `[bootstrap] ℹ️ An administrator account already exists (Role: ${result.role}, Status: ${result.isActive ? 'Active' : 'Inactive'}).`
      );
      console.info('[bootstrap] Preserving existing administrator account. No changes made.');
    } else if (result.status === 'CREATED') {
      console.info('=====================================================');
      console.info('✅ Initial SUPER_ADMIN account created successfully.');
      console.info('   Role: SUPER_ADMIN');
      console.info('   Status: Active');
      console.info('   Audit log recorded.');
      console.info('=====================================================');
    } else if (result.status === 'CONCURRENT_EXISTS') {
      console.warn('[bootstrap] ⚠️ Administrator account was created concurrently. Preserving existing account.');
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('[bootstrap] ❌ Bootstrap check failed:', err.message);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

bootstrap();
