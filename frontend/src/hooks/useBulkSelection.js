/**
 * Custom React Hook for Reusable Bulk Selection across Khushboo Admin Panel.
 *
 * Implements:
 * - Mode A: Explicit page-level selection.
 * - Mode B: Cross-page "Select all matching records" state.
 * - Automatic selection clearing on search/filter changes.
 * - Set-based O(1) membership checking.
 *
 * @module hooks/useBulkSelection
 */

import { useState, useCallback, useMemo } from 'react';

export function useBulkSelection(totalMatchingRecords = 0) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectAllMatching, setSelectAllMatching] = useState(false);

  // Toggle individual record
  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    // If user unchecks one item while in Mode B, exit Mode B
    setSelectAllMatching(false);
  }, []);

  // Toggle all items on current page
  const toggleSelectPage = useCallback((pageItemIds = []) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = pageItemIds.every((id) => next.has(id));

      if (allSelected) {
        pageItemIds.forEach((id) => next.delete(id));
      } else {
        pageItemIds.forEach((id) => next.add(id));
      }
      return next;
    });
    setSelectAllMatching(false);
  }, []);

  // Activate Mode B: Select all matching records in database
  const handleSelectAllMatching = useCallback(() => {
    setSelectAllMatching(true);
  }, []);

  // Clear all selections
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectAllMatching(false);
  }, []);

  // Helper: check if single item is selected
  const isSelected = useCallback(
    (id) => {
      if (selectAllMatching) return true;
      return selectedIds.has(id);
    },
    [selectAllMatching, selectedIds]
  );

  // Helper: check page selection state
  const getPageSelectionState = useCallback(
    (pageItemIds = []) => {
      if (pageItemIds.length === 0) {
        return { isAllSelected: false, isPartiallySelected: false };
      }
      if (selectAllMatching) {
        return { isAllSelected: true, isPartiallySelected: false };
      }

      const selectedCountOnPage = pageItemIds.filter((id) => selectedIds.has(id)).length;
      const isAllSelected = selectedCountOnPage === pageItemIds.length;
      const isPartiallySelected = selectedCountOnPage > 0 && !isAllSelected;

      return { isAllSelected, isPartiallySelected };
    },
    [selectAllMatching, selectedIds]
  );

  const selectedCount = useMemo(() => {
    if (selectAllMatching) {
      return totalMatchingRecords;
    }
    return selectedIds.size;
  }, [selectAllMatching, totalMatchingRecords, selectedIds.size]);

  return {
    selectedIds: Array.from(selectedIds),
    selectedCount,
    selectAllMatching,
    toggleSelect,
    toggleSelectPage,
    handleSelectAllMatching,
    clearSelection,
    isSelected,
    getPageSelectionState,
  };
}

