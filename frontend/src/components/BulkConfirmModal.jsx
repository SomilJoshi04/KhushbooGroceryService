/**
 * Reusable Confirmation & Outcome Summary Modal for Bulk Operations.
 *
 * Implements:
 * - Clear declaration of affected record count.
 * - Explicit reversibility notice (soft-delete vs purge).
 * - Optional mandatory audit reason input.
 * - Loading / in-flight state disabling double submissions.
 * - Detailed post-execution summary displaying succeeded, skipped (with reasons), and failed records.
 *
 * @module components/BulkConfirmModal
 */

import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  X,
  Loader2,
  ShieldAlert,
} from 'lucide-react';

export function BulkConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Bulk Action',
  description = 'Are you sure you want to perform this bulk action?',
  affectedCount = 0,
  itemName = 'records',
  confirmLabel = 'Confirm Action',
  confirmVariant = 'danger', // 'danger' | 'primary' | 'warning'
  requireReason = false,
  reasonPlaceholder = 'Enter mandatory reason for audit records...',
  reversibilityNotice = 'This operation will update or soft-delete eligible records. Business and legal audit records will be preserved.',
  loading = false,
  resultSummary = null, // { summary: { requested, succeeded, skipped, failed }, results: [...] }
  onDone,
}) {
  const [reason, setReason] = useState('');
  const [validationError, setValidationError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (requireReason && !reason.trim()) {
      setValidationError('Please enter a mandatory audit reason to continue.');
      return;
    }
    setValidationError('');
    onConfirm(reason.trim());
  };

  // If a result summary exists, show the outcome report
  if (resultSummary) {
    const { summary, results = [] } = resultSummary;
    const skippedItems = results.filter((r) => r.status === 'skipped');
    const failedItems = results.filter((r) => r.status === 'failed');

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-text-main/50 backdrop-blur-xs animate-fadeIn overflow-y-auto">
        <div className="bg-surface rounded-2xl border border-border-neutral shadow-2xl w-full max-w-md max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden my-auto">
          {/* Pinned Header */}
          <div className="flex items-center justify-between border-b border-border-neutral p-4 sm:p-5 shrink-0 bg-surface">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-status-success shrink-0" />
              <h3 className="text-base font-bold font-heading text-text-main">
                Bulk Operation Completed
              </h3>
            </div>
            <button
              type="button"
              onClick={onDone || onClose}
              className="p-1 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-subtle"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 rounded-xl bg-status-success/10 border border-status-success/20">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                  Succeeded
                </span>
                <span className="text-lg font-bold text-status-success font-mono">
                  {summary?.succeeded || 0}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-status-warning/10 border border-status-warning/20">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                  Skipped
                </span>
                <span className="text-lg font-bold text-status-warning font-mono">
                  {summary?.skipped || 0}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-status-error/10 border border-status-error/20">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                  Failed
                </span>
                <span className="text-lg font-bold text-status-error font-mono">
                  {summary?.failed || 0}
                </span>
              </div>
            </div>

            {/* Skipped reasons summary */}
            {skippedItems.length > 0 && (
              <div className="p-3 bg-surface-subtle border border-border-neutral rounded-xl space-y-1.5 max-h-36 overflow-y-auto text-xs">
                <span className="font-bold text-text-main block text-[11px]">
                  Skipped Safeguard Reasons:
                </span>
                {skippedItems.map((s, idx) => (
                  <div key={idx} className="text-[11px] text-text-muted flex items-start gap-1">
                    <span className="text-status-warning shrink-0">•</span>
                    <span>{s.reason || 'Protected by business rule.'}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Failed items summary */}
            {failedItems.length > 0 && (
              <div className="p-3 bg-status-error/10 border border-status-error/20 rounded-xl space-y-1.5 max-h-48 overflow-y-auto text-xs">
                <span className="font-bold text-status-error block text-[11px]">
                  Failure Reasons:
                </span>
                {failedItems.map((f, idx) => (
                  <div key={idx} className="text-[11px] text-status-error flex items-start gap-1.5 leading-snug">
                    <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-status-error" />
                    <span className="break-words flex-1">{f.reason}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pinned Footer */}
          <div className="p-4 border-t border-border-neutral shrink-0 bg-surface">
            <button
              type="button"
              onClick={onDone || onClose}
              className="w-full py-2.5 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl transition shadow-xs"
            >
              Done & Refresh
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-text-main/50 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="bg-surface rounded-2xl border border-border-neutral shadow-2xl w-full max-w-md max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden my-auto">
        {/* Pinned Header */}
        <div className="flex items-center justify-between border-b border-border-neutral p-4 sm:p-5 shrink-0 bg-surface">
          <div className="flex items-center gap-2">
            {confirmVariant === 'danger' ? (
              <ShieldAlert className="w-5 h-5 text-status-error shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-status-warning shrink-0" />
            )}
            <h3 className="text-base font-bold font-heading text-text-main">{title}</h3>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="p-1 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-subtle disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          <p className="text-xs text-text-main leading-relaxed">{description}</p>

          <div className="p-3 bg-surface-subtle border border-border-neutral rounded-xl flex items-center justify-between text-xs">
            <span className="font-medium text-text-muted">Targeted {itemName}:</span>
            <span className="font-bold text-brand font-mono text-sm">{affectedCount} selected</span>
          </div>

          {reversibilityNotice && (
            <p className="text-[11px] text-text-muted bg-brand-light/50 border border-brand/10 p-2.5 rounded-xl leading-normal">
              ℹ️ {reversibilityNotice}
            </p>
          )}

          {/* Reason Input (if required) */}
          {requireReason && (
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-text-main">
                Mandatory Audit Reason *
              </label>
              <textarea
                rows={2}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setValidationError('');
                }}
                placeholder={reasonPlaceholder}
                className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-xs text-text-main focus:outline-none focus:border-brand"
              />
              {validationError && (
                <p className="text-[11px] text-status-error font-semibold">{validationError}</p>
              )}
            </div>
          )}
        </div>

        {/* Pinned Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 p-4 border-t border-border-neutral shrink-0 bg-surface">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="px-4 py-2 border border-border-neutral text-xs font-semibold text-text-muted hover:text-text-main rounded-xl hover:bg-surface-subtle transition disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={handleSubmit}
            className={`px-5 py-2 text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5 disabled:opacity-50 ${
              confirmVariant === 'danger'
                ? 'bg-status-error text-white hover:bg-status-error/90'
                : confirmVariant === 'warning'
                ? 'bg-status-warning text-white hover:bg-status-warning/90'
                : 'bg-brand text-white hover:bg-brand-hover'
            }`}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

