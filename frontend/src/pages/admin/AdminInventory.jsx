/**
 * Admin Inventory Management View.
 *
 * Route: /admin/inventory
 * Real-time stock monitor with low-stock alerts and instant replenishment controls.
 *
 * @module pages/admin/AdminInventory
 */

import React, { useState, useEffect } from 'react';
import { apiClient } from '../../config/api.js';
import {
  Boxes,
  AlertTriangle,
  Search,
  RefreshCw,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  ArrowUpDown,
  RotateCcw,
  FolderTree,
  Filter,
} from 'lucide-react';
import { Pagination } from '../../components/Pagination.jsx';
import { useBulkSelection } from '../../hooks/useBulkSelection.js';
import { BulkActionBar } from '../../components/BulkActionBar.jsx';
import { BulkConfirmModal } from '../../components/BulkConfirmModal.jsx';
import { SkeletonTable } from '../../components/skeleton/index.js';

export function AdminInventory() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [stockStatus, setStockStatus] = useState('ALL'); // 'ALL' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'IN_STOCK'
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState({ totalPages: 1, totalRecords: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isFirstMount = React.useRef(true);
  const abortControllerRef = React.useRef(null);

  // Stock Adjustment Modal
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [newStock, setNewStock] = useState(0);
  const [reason, setReason] = useState('New inventory shipment arrival');
  const [adjusting, setAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState('');

  // Bulk Selection hook & modals
  const bulk = useBulkSelection(pagination.totalRecords);
  const [bulkConfig, setBulkConfig] = useState(null);
  const [bulkResultSummary, setBulkResultSummary] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Load categories on mount for dynamic filtering
  useEffect(() => {
    let isMounted = true;
    apiClient
      .get('/v1/categories')
      .then((res) => {
        if (isMounted && res.data?.success) {
          setCategories(res.data.data || []);
        }
      })
      .catch((err) => {
        console.warn('[AdminInventory] Failed to fetch categories for filter:', err.message);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const isFiltered = selectedCategory !== 'ALL' || search.trim() !== '' || stockStatus !== 'ALL';

  const handleClearFilters = () => {
    setSelectedCategory('ALL');
    setSearch('');
    setStockStatus('ALL');
    setPage(1);
  };

  const fetchInventory = async (targetPage = page) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const params = {
        page: targetPage,
        limit: pageSize,
      };
      if (selectedCategory && selectedCategory !== 'ALL') {
        params.categoryId = selectedCategory;
      }
      if (stockStatus && stockStatus !== 'ALL') {
        params.stockStatus = stockStatus;
      }
      if (search.trim()) {
        params.search = search.trim();
      }

      const res = await apiClient.get('/v1/admin/inventory', {
        params,
        signal: controller.signal,
      });

      if (res.data?.success) {
        setItems(res.data.data || []);
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        } else {
          setPagination({
            totalPages: res.data.totalPages || 1,
            totalRecords: res.data.total || (res.data.data ? res.data.data.length : 0),
          });
        }
        bulk.clearSelection();
      }
    } catch (err) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
        return;
      }
      setError(err.response?.data?.message || err.message || 'Failed to load inventory.');
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  const handleTriggerBulkReplenish = (delta = 10) => {
    setBulkConfig({
      title: `Bulk Restock (${delta > 0 ? `+${delta}` : delta} Units)`,
      description: `Replenish ${delta} units across ${bulk.selectedCount} selected SKU(s).`,
      affectedCount: bulk.selectedCount,
      itemName: 'inventory SKUs',
      confirmLabel: `Add +${delta} to Stock`,
      confirmVariant: 'primary',
      requireReason: true,
      reasonPlaceholder: 'Mandatory audit reason (e.g. Shipment arrival / warehouse restocking)...',
      reversibilityNotice: 'Stock movements are recorded and validated through the inventory audit system.',
      onConfirm: async (auditReason) => {
        setBulkLoading(true);
        try {
          const adjustments = items
            .filter((item) => bulk.isSelected(item.sku))
            .map((item) => ({ sku: item.sku, delta }));

          const res = await apiClient.post('/v1/admin/inventory/bulk-adjust', {
            adjustments,
            delta,
            reason: auditReason,
          });
          setBulkResultSummary(res.data);
        } catch (err) {
          setError(err.response?.data?.message || 'Bulk inventory adjustment failed.');
          setBulkConfig(null);
        } finally {
          setBulkLoading(false);
        }
      },
    });
  };

  const handleBulkExport = () => {
    const selectedItems = items.filter((item) => bulk.isSelected(item.sku));
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      ['SKU,Product Name,Department,Pack Size,Price (INR),Stock']
        .concat(
          selectedItems.map(
            (i) =>
              `"${i.sku}","${i.productName}","${i.categoryName}","${i.label}",${(i.pricePaise / 100).toFixed(0)},${i.stock}`
          )
        )
        .join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `khushboo_inventory_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    fetchInventory(page);
  }, [page, pageSize, selectedCategory, stockStatus]);

  // Debounced search
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setPage(1);
      fetchInventory(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const handleOpenAdjust = (item) => {
    setSelectedItem(item);
    setNewStock(item.stock);
    setReason('New shipment arrival at warehouse');
    setAdjustError('');
    setAdjustModalOpen(true);
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;
    setAdjusting(true);
    setAdjustError('');

    try {
      await apiClient.patch(`/v1/admin/products/${selectedItem.productId}/stock`, {
        sku: selectedItem.sku,
        stock: Number(newStock),
        reason,
      });

      setAdjustModalOpen(false);
      await fetchInventory();
    } catch (err) {
      setAdjustError(err.response?.data?.message || err.message || 'Failed to update stock.');
    } finally {
      setAdjusting(false);
    }
  };

  const lowStockCount = items.filter((i) => i.isLowStock).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-text-main">Inventory & Stock Levels</h1>
          <p className="text-xs text-text-muted mt-1">
            Track variant quantities, restock shipments, and monitor warehouse depletion.
          </p>
        </div>
      </div>

      {/* Toolbar & Multi-Criteria Filtering */}
      <div className="bg-surface border border-border-neutral rounded-2xl p-4 shadow-xs space-y-3">
        {/* Row 1: Search & Category */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Input */}
          <div className="md:col-span-7 relative">
            <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by product name, SKU, pack size, or department..."
              className="w-full bg-primary-bg border border-border-neutral rounded-xl pl-10 pr-9 py-2.5 text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-3 text-text-muted hover:text-text-main p-0.5"
                title="Clear search query"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <div className="md:col-span-5 relative flex items-center gap-2">
            <div className="relative flex-1">
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-primary-bg border border-border-neutral rounded-xl px-3.5 py-2.5 text-xs font-semibold text-text-main focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand cursor-pointer"
              >
                <option value="ALL">All Categories ({categories.length} available)</option>
                {categories.map((cat) => (
                  <option key={cat._id} value={cat._id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Row 2: Stock Filter & Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-border-neutral/60">
          {/* Stock Filter Segmented Pills */}
          <div className="flex items-center gap-1.5 p-1 bg-surface-subtle border border-border-neutral rounded-xl text-xs overflow-x-auto">
            <button
              type="button"
              onClick={() => {
                setStockStatus('ALL');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap ${
                stockStatus === 'ALL'
                  ? 'bg-surface text-brand font-bold shadow-xs border border-border-neutral'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              All Stock
            </button>
            <button
              type="button"
              onClick={() => {
                setStockStatus('LOW_STOCK');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap flex items-center gap-1.5 ${
                stockStatus === 'LOW_STOCK'
                  ? 'bg-status-warning text-white font-bold shadow-xs'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Low Stock (≤10)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setStockStatus('OUT_OF_STOCK');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap flex items-center gap-1.5 ${
                stockStatus === 'OUT_OF_STOCK'
                  ? 'bg-status-error text-white font-bold shadow-xs'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Out of Stock (0)</span>
            </button>
          </div>

          {/* Action Buttons: Clear Filters & Refresh */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleClearFilters}
              disabled={!isFiltered}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition shadow-xs ${
                isFiltered
                  ? 'bg-surface hover:bg-surface-subtle text-status-error border-status-error/30 hover:border-status-error cursor-pointer'
                  : 'opacity-40 bg-surface-subtle text-text-muted border-border-neutral cursor-not-allowed'
              }`}
              title="Reset all category, search, and stock filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear Filters</span>
            </button>

            <button
              type="button"
              onClick={() => fetchInventory(page)}
              className="px-3.5 py-2 bg-surface hover:bg-surface-subtle border border-border-neutral text-xs font-semibold text-text-main rounded-xl flex items-center gap-1.5 transition shadow-xs"
              title="Reload latest stock levels from database"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-text-muted ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh Stock</span>
            </button>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      {loading ? (
        <SkeletonTable rows={7} columns={6} showToolbar={false} showPagination={true} />
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-200 text-status-error rounded-2xl text-center space-y-2">
          <p className="font-semibold text-xs">{error}</p>
          {isFiltered && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="px-3.5 py-1.5 bg-brand text-white rounded-xl text-xs font-semibold transition"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : items.length === 0 ? (
        <div className="p-12 text-center bg-surface border border-border-neutral rounded-2xl space-y-3 shadow-xs">
          <Boxes className="w-10 h-10 text-text-muted/40 mx-auto" />
          <h3 className="text-base font-bold text-text-main">
            {selectedCategory !== 'ALL'
              ? `No inventory records found in "${categories.find((c) => c._id === selectedCategory)?.name || 'this category'}".`
              : 'No inventory items match the current filters.'}
          </h3>
          <p className="text-xs text-text-muted max-w-md mx-auto">
            {isFiltered
              ? 'Try searching with a different term, selecting another category, or resetting all filters.'
              : 'No product variants currently exist in the store.'}
          </p>
          {isFiltered && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-semibold transition shadow-xs"
            >
              Clear All Filters
            </button>
          )}
        </div>
      ) : (
        <div className="bg-surface border border-border-neutral rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px] text-left text-xs">
              <thead className="bg-surface-subtle text-[11px] uppercase tracking-wider text-text-muted border-b border-border-neutral">
                <tr>
                  <th className="p-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        items.length > 0 &&
                        bulk.getPageSelectionState(items.map((i) => i.sku)).isAllSelected
                      }
                      onChange={() => bulk.toggleSelectPage(items.map((i) => i.sku))}
                      className="rounded accent-brand"
                    />
                  </th>
                  <th className="p-4 font-semibold">SKU</th>
                  <th className="p-4 font-semibold">Product Name</th>
                  <th className="p-4 font-semibold">Department</th>
                  <th className="p-4 font-semibold">Pack Size</th>
                  <th className="p-4 font-semibold">Selling Price</th>
                  <th className="p-4 font-semibold">Available Stock</th>
                  <th className="p-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-neutral">
                {items.map((item) => {
                  const isSelected = bulk.isSelected(item.sku);
                  return (
                    <tr
                      key={item.sku}
                      className={`transition ${isSelected ? 'bg-brand-light/30' : 'hover:bg-surface-subtle/60'}`}
                    >
                      <td className="p-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => bulk.toggleSelect(item.sku)}
                          className="rounded accent-brand"
                        />
                      </td>
                      <td className="p-4 font-mono font-bold text-brand">{item.sku}</td>
                    <td className="p-4 font-bold text-text-main max-w-xs truncate">{item.productName}</td>
                    <td className="p-4 text-text-muted">{item.categoryName}</td>
                    <td className="p-4 text-text-main font-semibold">{item.label}</td>
                    <td className="p-4 font-bold text-text-main">₹{(item.pricePaise / 100).toFixed(0)}</td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold inline-block ${
                          item.stock === 0
                            ? 'bg-red-50 text-status-error border border-red-200'
                            : item.stock <= 10
                            ? 'bg-amber-50 text-status-warning border border-amber-200'
                            : 'bg-emerald-50 text-status-success border border-emerald-200'
                        }`}
                      >
                        {item.stock} {item.unit} {item.stock === 0 ? '(Out of Stock)' : item.stock <= 10 ? '(Low Stock)' : ''}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenAdjust(item)}
                        className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-subtle border border-border-neutral text-brand font-semibold text-xs transition shadow-xs"
                      >
                        Adjust Stock
                      </button>
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>

          <div className="px-5 pb-3">
            <Pagination
              currentPage={page}
              totalPages={pagination.totalPages}
              totalRecords={pagination.totalRecords}
              pageSize={pageSize}
              onPageChange={(p) => setPage(p)}
              onPageSizeChange={(sz) => {
                setPageSize(sz);
                setPage(1);
              }}
              pageSizeOptions={[10, 20, 50]}
              loading={loading}
              itemName="inventory items"
            />
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {adjustModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
          <div className="relative w-full max-w-md bg-surface border border-border-neutral rounded-2xl p-6 text-text-main shadow-xl space-y-4">
            <button
              onClick={() => setAdjustModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-subtle transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold font-heading text-text-main">Adjust Variant Stock</h3>
            <div className="bg-surface-subtle p-3.5 rounded-xl border border-border-neutral text-xs space-y-1">
              <p className="font-bold text-text-main">{selectedItem.productName}</p>
              <p className="text-text-muted font-mono">SKU: {selectedItem.sku} • {selectedItem.label}</p>
              <p className="text-brand font-semibold">Current Count: {selectedItem.stock} units</p>
            </div>

            {adjustError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-status-error">
                {adjustError}
              </div>
            )}

            <form onSubmit={handleAdjustSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-text-main mb-1">New Total Stock Quantity</label>
                <input
                  type="number"
                  value={newStock}
                  onChange={(e) => setNewStock(e.target.value)}
                  required
                  min={0}
                  className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-text-main text-base font-bold focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-text-main mb-1">Reason for Adjustment</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  placeholder="e.g. Shipment arrival / warehouse count reconciliation"
                  className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-text-main placeholder:text-text-muted focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-surface hover:bg-surface-subtle border border-border-neutral text-text-main font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjusting}
                  className="flex-1 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white font-semibold transition disabled:opacity-50 shadow-xs"
                >
                  {adjusting ? 'Saving...' : 'Update Inventory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contextual Bulk Action Bar */}
      <BulkActionBar
        selectedCount={bulk.selectedCount}
        totalMatching={pagination.totalRecords}
        currentPageCount={items.length}
        selectAllMatching={bulk.selectAllMatching}
        onSelectAllMatching={bulk.handleSelectAllMatching}
        onClearSelection={bulk.clearSelection}
        itemName="inventory items"
        actions={[
          {
            id: 'restock10',
            label: 'Restock +10',
            icon: Plus,
            variant: 'primary',
            onClick: () => handleTriggerBulkReplenish(10),
          },
          {
            id: 'restock50',
            label: 'Restock +50',
            icon: Plus,
            variant: 'primary',
            onClick: () => handleTriggerBulkReplenish(50),
          },
          {
            id: 'export',
            label: 'Export CSV',
            icon: ArrowUpDown,
            variant: 'neutral',
            onClick: handleBulkExport,
          },
        ]}
      />

      {/* Bulk Confirm Modal */}
      {bulkConfig && (
        <BulkConfirmModal
          isOpen={Boolean(bulkConfig)}
          onClose={() => {
            setBulkConfig(null);
            setBulkResultSummary(null);
          }}
          onConfirm={(reason) => bulkConfig.onConfirm(reason)}
          title={bulkConfig.title}
          description={bulkConfig.description}
          affectedCount={bulkConfig.affectedCount}
          itemName={bulkConfig.itemName}
          confirmLabel={bulkConfig.confirmLabel}
          confirmVariant={bulkConfig.confirmVariant}
          requireReason={bulkConfig.requireReason}
          reasonPlaceholder={bulkConfig.reasonPlaceholder}
          reversibilityNotice={bulkConfig.reversibilityNotice}
          loading={bulkLoading}
          resultSummary={bulkResultSummary}
          onDone={() => {
            setBulkConfig(null);
            setBulkResultSummary(null);
            fetchInventory();
          }}
        />
      )}
    </div>
  );
}
