/**
 * Contextual Reusable Bulk Actions Bar for Khushboo Admin Panel.
 *
 * Implements:
 * - Counter badge displaying selected record count.
 * - Mode A vs Mode B promotion banner ("Select all matching records").
 * - Dynamic configurable action buttons with primary/danger/neutral variants.
 * - Mobile-responsive docked bar with safe area padding and clean typography.
 *
 * @module components/BulkActionBar
 */

import React from 'react';
import { CheckSquare, X, ChevronRight } from 'lucide-react';

export function BulkActionBar({
  selectedCount = 0,
  totalMatching = 0,
  currentPageCount = 0,
  selectAllMatching = false,
  onSelectAllMatching,
  onClearSelection,
  actions = [],
  itemName = 'records',
}) {
  if (selectedCount === 0) return null;

  const showModeBPrompt =
    !selectAllMatching &&
    totalMatching > currentPageCount &&
    selectedCount >= currentPageCount;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-8 z-40 max-w-2xl bg-surface/95 backdrop-blur-md border border-border-neutral rounded-2xl p-3 sm:p-4 shadow-xl text-text-main animate-fadeIn">
      {/* Mode B promotion banner */}
      {showModeBPrompt && (
        <div className="mb-2.5 pb-2.5 border-b border-border-neutral/60 flex items-center justify-between text-xs text-text-muted">
          <span>
            All <strong className="text-text-main">{currentPageCount}</strong> {itemName} on this page are selected.
          </span>
          <button
            type="button"
            onClick={onSelectAllMatching}
            className="text-brand font-bold hover:underline inline-flex items-center gap-0.5 ml-2"
          >
            <span>Select all {totalMatching} matching {itemName}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Count & Clear Badge */}
        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 rounded-xl bg-brand/10 border border-brand/20 text-brand font-bold text-xs flex items-center gap-1.5">
            <CheckSquare className="w-3.5 h-3.5" />
            <span>
              {selectAllMatching
                ? `All ${totalMatching} matching ${itemName} selected`
                : `${selectedCount} selected`}
            </span>
          </div>

          <button
            type="button"
            onClick={onClearSelection}
            className="p-1 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-subtle transition"
            title="Clear selection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {actions.map((act) => {
            const Icon = act.icon;
            let btnStyle = 'bg-surface hover:bg-surface-subtle text-text-main border-border-neutral';

            if (act.variant === 'danger') {
              btnStyle = 'bg-status-error/10 text-status-error border-status-error/20 hover:bg-status-error/20';
            } else if (act.variant === 'primary') {
              btnStyle = 'bg-brand text-white border-transparent hover:bg-brand-hover shadow-xs';
            } else if (act.variant === 'warning') {
              btnStyle = 'bg-status-warning/10 text-status-warning border-status-warning/20 hover:bg-status-warning/20';
            } else if (act.variant === 'success') {
              btnStyle = 'bg-status-success/10 text-status-success border-status-success/20 hover:bg-status-success/20';
            }

            return (
              <button
                key={act.id}
                type="button"
                disabled={act.disabled}
                onClick={act.onClick}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${btnStyle}`}
              >
                {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
                <span>{act.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

