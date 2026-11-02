/**
 * Centralized Reusable Bulk Operations Engine for Khushboo Grocery Service.
 *
 * Implements:
 * - Mode A: Explicit validated record ID batch processing.
 * - Mode B: Safe authorized filter-based bulk execution.
 * - Batch size enforcement (configurable default 100, max 250).
 * - Per-record isolation preventing cascading failures.
 * - Consistent outcome reporting: { requested, succeeded, skipped, failed }.
 * - Automated append-only audit logging via AuditLog model.
 *
 * @module utils/bulkOperations
 */

import mongoose from 'mongoose';
import { AuditLog } from '../models/AuditLog.js';

export const DEFAULT_MAX_BULK_BATCH = 100;
export const HARD_MAX_BULK_BATCH = 250;

/**
 * Standard bulk action runner.
 *
 * @param {object} options
 * @param {import('express').Request} options.req - Express Request with req.user and req.id
 * @param {mongoose.Model} options.model - Mongoose Model
 * @param {string[]} [options.ids] - Array of record IDs (Mode A)
 * @param {boolean} [options.selectAllMatching] - Whether Mode B applies
 * @param {object} [options.filter] - Base filter when selectAllMatching is true
 * @param {string} options.actionName - e.g. 'BULK_DELETE', 'BULK_SUSPEND', 'BULK_ACTIVATE'
 * @param {string} options.entityName - e.g. 'Customer', 'Product', 'CustomerInquiry', 'DeliveryZone'
 * @param {Function} options.handler - Async callback per item: async (doc, context) => { status: 'success' | 'skipped' | 'failed', reason?: string }
 * @param {object} [options.context={}] - Additional context like reasons, status targets, etc.
 * @param {number} [options.maxBatchSize=DEFAULT_MAX_BULK_BATCH]
 * @returns {Promise<{ success: boolean, summary: { requested: number, succeeded: number, skipped: number, failed: number }, results: Array<{ id: string, status: string, reason?: string }> }>}
 */
export async function executeBulkOperation({
  req,
  model,
  ids = [],
  selectAllMatching = false,
  filter = {},
  actionName,
  entityName,
  handler,
  context = {},
  maxBatchSize = DEFAULT_MAX_BULK_BATCH,
}) {
  const adminId = req.user?._id;
  const adminRole = req.user?.role || 'ADMIN';
  const ipAddress = req.ip || '';
  const requestId = req.id || '';

  let targetIds = [];

  if (selectAllMatching) {
    // Mode B: Resolve eligible records matching the verified server-side filter
    const docs = await model.find(filter).select('_id').limit(maxBatchSize).lean();
    targetIds = docs.map((d) => d._id.toString());
  } else {
    // Mode A: Deduplicate and validate explicit IDs
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error('No record IDs were provided for bulk execution.');
    }

    const uniqueIds = Array.from(new Set(ids.map((id) => String(id).trim()))).filter(Boolean);

    if (uniqueIds.length > maxBatchSize) {
      throw new Error(
        `Batch size exceeds maximum limit of ${maxBatchSize} records. Please select fewer records.`
      );
    }

    for (const id of uniqueIds) {
      if (!mongoose.isValidObjectId(id)) {
        throw new Error(`Invalid record ID format: "${id}".`);
      }
    }

    targetIds = uniqueIds;
  }

  const requested = targetIds.length;
  let succeeded = 0;
  let skipped = 0;
  let failed = 0;
  const results = [];

  // Fetch actual documents for isolated, rule-enforced processing
  const docs = await model.find({ _id: { $in: targetIds } });
  const docMap = new Map(docs.map((d) => [d._id.toString(), d]));

  for (const id of targetIds) {
    const doc = docMap.get(id);

    if (!doc) {
      skipped++;
      results.push({
        id,
        status: 'skipped',
        reason: 'Record not found or already deleted.',
      });
      continue;
    }

    try {
      const outcome = await handler(doc, {
        ...context,
        req,
        adminId,
        adminRole,
      });

      if (outcome.status === 'success' || outcome.status === 'succeeded') {
        succeeded++;
        results.push({ id, status: 'success', note: outcome.note });
      } else if (outcome.status === 'skipped') {
        skipped++;
        results.push({ id, status: 'skipped', reason: outcome.reason || 'Skipped by business rule.' });
      } else {
        failed++;
        results.push({ id, status: 'failed', reason: outcome.reason || 'Operation failed.' });
      }
    } catch (err) {
      failed++;
      results.push({
        id,
        status: 'failed',
        reason: err.message || 'Unexpected processing error occurred.',
      });
    }
  }

  // Record audit log for the entire operation summary
  try {
    await AuditLog.create({
      action: actionName,
      performedBy: adminId,
      performerRole: adminRole,
      targetType: entityName,
      targetId: 'BULK_BATCH',
      details: {
        requested,
        succeeded,
        skipped,
        failed,
        context: {
          reason: context.reason || undefined,
          targetStatus: context.targetStatus || undefined,
        },
        sampleResults: results.slice(0, 10), // Safe sample without overflowing logs
      },
      ipAddress,
      requestId,
    });
  } catch (auditErr) {
    console.error(`[AuditLog] Failed to record bulk action ${actionName}:`, auditErr.message);
  }

  return {
    success: true,
    summary: {
      requested,
      succeeded,
      skipped,
      failed,
    },
    results,
  };
}
