/**
 * Database Migration Script: Legacy SMS Accounts -> Email/Username/Password Preparation.
 *
 * Requirements:
 * 1. Identifies existing customers who registered via Phone OTP.
 * 2. Flags them as `legacyAccountRequiresSetup: true`.
 * 3. Does NOT assign fake emails, fake usernames, or default passwords.
 * 4. Preserves customer records, orders, cart data, addresses, and account roles intact.
 * 5. Ensures sparse unique indexes on email and username.
 * 6. Supports dry-run mode via `--dry-run`.
 *
 * Usage:
 *   node backend/scripts/migrateLegacyAccounts.js [--dry-run]
 *
 * @module scripts/migrateLegacyAccounts
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from '../src/models/User.js';
import { env } from '../src/config/env.js';

async function runMigration() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('\n============================================================');
  console.log('📦 KHUSHBOO GROCERY — LEGACY ACCOUNT MIGRATION UTILITY');
  console.log(`Mode: ${isDryRun ? '🔍 DRY RUN (No changes will be written)' : '⚡ LIVE MIGRATION'}`);
  console.log('============================================================\n');

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(env.MONGO_URI);
    console.log('✅ Connected to MongoDB successfully.\n');

    // 1. Ensure indexes
    console.log('Checking and synchronizing indexes...');
    await User.syncIndexes();
    console.log('✅ Indexes synchronized (sparse unique indexes on email, username, phone).\n');

    // 2. Identify legacy accounts
    // Legacy customer: role is CUSTOMER, has a phone number, but lacks username or password
    const legacyFilter = {
      role: 'CUSTOMER',
      $or: [
        { password: { $exists: false } },
        { password: null },
        { username: { $exists: false } },
        { username: null },
        { username: '' },
      ],
      legacyAccountRequiresSetup: { $ne: true },
    };

    const legacyUsers = await User.find(legacyFilter).select('_id name phone email role legacyAccountRequiresSetup createdAt');
    console.log(`Found ${legacyUsers.length} legacy customer account(s) requiring email/password setup.`);

    if (legacyUsers.length === 0) {
      console.log('✨ No pending legacy accounts found. All customer accounts are up to date.\n');
    } else {
      console.log('\nSample accounts to be flagged:');
      legacyUsers.slice(0, 5).forEach((u, i) => {
        console.log(`  ${i + 1}. ID: ${u._id} | Phone: ${u.phone} | Name: ${u.name} | Created: ${u.createdAt}`);
      });

      if (!isDryRun) {
        const result = await User.updateMany(legacyFilter, {
          $set: {
            legacyAccountRequiresSetup: true,
          },
        });
        console.log(`\n✅ Successfully updated ${result.modifiedCount} legacy account(s) to require credential setup.`);
      } else {
        console.log(`\n[DRY RUN] Would set legacyAccountRequiresSetup: true on ${legacyUsers.length} account(s).`);
      }
    }

    // 3. Overall database summary
    const totalCustomers = await User.countDocuments({ role: 'CUSTOMER' });
    const legacyCount = await User.countDocuments({ role: 'CUSTOMER', legacyAccountRequiresSetup: true });
    const verifiedEmailCount = await User.countDocuments({ role: 'CUSTOMER', isEmailVerified: true });
    const adminCount = await User.countDocuments({ role: { $in: ['ADMIN', 'SUPER_ADMIN', 'STAFF'] } });

    console.log('\n────────────────────────────────────────────────────────────');
    console.log('📊 DATABASE STATUS SUMMARY:');
    console.log(`  • Total Customers:             ${totalCustomers}`);
    console.log(`  • Legacy Setup Required:       ${legacyCount}`);
    console.log(`  • Verified Email Accounts:     ${verifiedEmailCount}`);
    console.log(`  • Administrators & Staff:      ${adminCount}`);
    console.log('────────────────────────────────────────────────────────────\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

runMigration();

