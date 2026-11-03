/**
 * Generic Table & Admin Management Page Skeletons.
 *
 * Provides responsive, column-aligned table placeholders for Admin Products,
 * Orders, Customers, Inventory, Categories, and Coupons.
 *
 * @module components/skeleton/SkeletonTable
 */

import React from 'react';
import { SkeletonBase, SkeletonBadge, SkeletonButton } from './SkeletonBase.jsx';

/**
 * Single skeleton table row matching admin data tables.
 */
export function SkeletonTableRow({ columns = 5 }) {
  return (
    <tr aria-hidden="true" className="border-b border-border-neutral/70">
      {/* Checkbox cell */}
      <td className="p-3.5 w-10">
        <SkeletonBase className="w-4 h-4 rounded" />
      </td>

      {/* Main item cell (thumbnail + 2 lines of text) */}
      <td className="p-3.5">
        <div className="flex items-center gap-3">
          <SkeletonBase className="w-10 h-10 rounded-lg shrink-0" />
          <div className="space-y-1.5 flex-1 min-w-[120px]">
            <SkeletonBase className="h-3.5 w-4/5 rounded" />
            <SkeletonBase className="h-3 w-1/2 rounded" />
          </div>
        </div>
      </td>

      {/* Dynamic middle cells */}
      {[...Array(Math.max(1, columns - 3))].map((_, i) => (
        <td key={i} className="p-3.5">
          <SkeletonBase className="h-3.5 w-20 rounded" />
        </td>
      ))}

      {/* Status cell */}
      <td className="p-3.5 w-28">
        <SkeletonBadge width="w-20" height="h-6" rounded="rounded-full" />
      </td>

      {/* Action cell */}
      <td className="p-3.5 w-24 text-right">
        <SkeletonBase className="h-7 w-16 rounded-lg ml-auto" />
      </td>
    </tr>
  );
}

/**
 * Complete Data Table Skeleton with toolbar and pagination.
 */
export function SkeletonTable({
  rows = 6,
  columns = 5,
  hasToolbar = true,
  className = '',
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading table data"
      className={`space-y-4 ${className}`}
    >
      {/* Optional Table Filter & Action Toolbar */}
      {hasToolbar && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-3.5 rounded-xl border border-border-neutral shadow-2xs">
          {/* Search bar placeholder */}
          <SkeletonBase className="h-9 w-full sm:w-64 rounded-xl" />

          {/* Filter Pills / Action buttons */}
          <div className="flex items-center gap-2">
            <SkeletonBase className="h-8 w-20 rounded-lg" />
            <SkeletonBase className="h-8 w-24 rounded-lg" />
            <SkeletonButton height="h-9" width="w-28" rounded="rounded-xl" />
          </div>
        </div>
      )}

      {/* Table Container */}
      <div className="bg-surface border border-border-neutral rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-surface-subtle/80 border-b border-border-neutral text-text-muted">
              <tr>
                <th className="p-3.5 w-10">
                  <SkeletonBase className="w-4 h-4 rounded" />
                </th>
                <th className="p-3.5">
                  <SkeletonBase className="h-3.5 w-24 rounded" />
                </th>
                {[...Array(Math.max(1, columns - 3))].map((_, i) => (
                  <th key={i} className="p-3.5">
                    <SkeletonBase className="h-3.5 w-20 rounded" />
                  </th>
                ))}
                <th className="p-3.5 w-28">
                  <SkeletonBase className="h-3.5 w-16 rounded" />
                </th>
                <th className="p-3.5 w-24 text-right">
                  <SkeletonBase className="h-3.5 w-12 rounded ml-auto" />
                </th>
              </tr>
            </thead>
            <tbody>
              {[...Array(rows)].map((_, idx) => (
                <SkeletonTableRow key={idx} columns={columns} />
              ))}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Footer */}
        <div className="p-3.5 border-t border-border-neutral bg-surface flex items-center justify-between">
          <SkeletonBase className="h-3.5 w-32 rounded" />
          <div className="flex items-center gap-1.5">
            <SkeletonBase className="w-8 h-8 rounded-lg" />
            <SkeletonBase className="w-8 h-8 rounded-lg" />
            <SkeletonBase className="w-8 h-8 rounded-lg" />
          </div>
        </div>
      </div>
      <span className="sr-only">Loading records...</span>
    </div>
  );
}

