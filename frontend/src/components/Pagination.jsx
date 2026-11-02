/**
 * Reusable Production-Ready Pagination Component.
 *
 * Designed to conform to the Khushboo Grocery design system.
 * Features:
 * - Deterministic, backend-driven page state.
 * - Accurate results range calculation: "Showing X–Y of Z records".
 * - Configurable page-size selector (e.g. 10, 20, 50).
 * - Windowed page numbers with ellipsis for large page counts.
 * - Mobile-optimized responsive layout (no horizontal overflow).
 * - Keyboard accessible, disabled states, and smooth transition.
 *
 * @module components/Pagination
 */

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pagination({
  currentPage = 1,
  totalPages = 1,
  totalRecords,
  totalOrders,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  loading = false,
  itemName = 'records',
}) {
  // Support either totalRecords or totalOrders for backward compatibility
  const total = totalRecords !== undefined ? totalRecords : (totalOrders !== undefined ? totalOrders : 0);

  // If no items exist, don't show pagination bar
  if (total === 0) {
    return null;
  }

  const startRange = (currentPage - 1) * pageSize + 1;
  const endRange = Math.min(currentPage * pageSize, total);

  // Generate windowed page numbers array (e.g. [1, 2, 3, '...', 10])
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages = [];
    pages.push(1);

    if (currentPage > 3) {
      pages.push('...');
    }

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (currentPage < totalPages - 2) {
      pages.push('...');
    }

    pages.push(totalPages);
    return pages;
  };

  const pageNumbers = getPageNumbers();

  const handlePageClick = (page) => {
    if (page === currentPage || page === '...' || loading) return;
    if (page >= 1 && page <= totalPages) {
      onPageChange(page);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 pb-2 border-t border-border-neutral text-xs">
      {/* Results Range Information & Page-Size Selector */}
      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3 text-text-muted font-medium text-center sm:text-left">
        <div>
          Showing{' '}
          <span className="font-bold text-text-main font-mono">
            {startRange}–{endRange}
          </span>{' '}
          of <span className="font-bold text-text-main font-mono">{total}</span> {itemName}
        </div>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 pl-2 border-l border-border-neutral text-text-muted">
            <span className="hidden xs:inline">Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              disabled={loading}
              aria-label="Rows per page"
              className="bg-surface border border-border-neutral rounded-lg px-2 py-1 text-xs text-text-main font-semibold focus:outline-none focus:border-brand cursor-pointer shadow-2xs"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} / page
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      <nav
        aria-label="Pagination Navigation"
        className="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-center"
      >
        {/* Previous Button */}
        <button
          type="button"
          onClick={() => handlePageClick(currentPage - 1)}
          disabled={currentPage <= 1 || loading}
          aria-label="Go to previous page"
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border-neutral bg-surface text-text-main hover:bg-surface-subtle font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs select-none"
        >
          <ChevronLeft className="w-3.5 h-3.5 text-text-muted" />
          <span className="hidden xs:inline">Previous</span>
        </button>

        {/* Page Number Buttons (Desktop & Tablet) */}
        <div className="hidden sm:flex items-center gap-1">
          {pageNumbers.map((page, index) => {
            if (page === '...') {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="px-2 py-1 text-text-muted font-bold select-none"
                  aria-hidden="true"
                >
                  …
                </span>
              );
            }

            const isActive = page === currentPage;
            return (
              <button
                key={`page-${page}`}
                type="button"
                onClick={() => handlePageClick(page)}
                disabled={loading}
                aria-current={isActive ? 'page' : undefined}
                aria-label={`Page ${page}`}
                className={`min-w-8 h-8 px-2.5 rounded-lg font-bold text-xs transition shadow-2xs select-none ${
                  isActive
                    ? 'bg-brand text-white border border-brand'
                    : 'bg-surface text-text-muted hover:text-text-main hover:bg-surface-subtle border border-border-neutral'
                } disabled:cursor-not-allowed`}
              >
                {page}
              </button>
            );
          })}
        </div>

        {/* Mobile Page Indicator (Visible on < 640px) */}
        <div className="sm:hidden px-3 py-1 font-bold text-text-main bg-surface-subtle rounded-lg border border-border-neutral font-mono">
          {currentPage} / {totalPages}
        </div>

        {/* Next Button */}
        <button
          type="button"
          onClick={() => handlePageClick(currentPage + 1)}
          disabled={currentPage >= totalPages || loading}
          aria-label="Go to next page"
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border-neutral bg-surface text-text-main hover:bg-surface-subtle font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs select-none"
        >
          <span className="hidden xs:inline">Next</span>
          <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
        </button>
      </nav>
    </div>
  );
}
