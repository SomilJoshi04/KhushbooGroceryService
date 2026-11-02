/**
 * Centralized Backend Pagination Utility.
 *
 * Implements:
 * - Strict parameter validation and normalization (no NaN, decimals, or negative values).
 * - Enforced page-size bounds (default 10, max 100).
 * - Deterministic MongoDB sorting with _id tie-breaker.
 * - Allowlisted sort field checking to prevent query injection.
 * - Standardized pagination metadata conforming to Khushboo Grocery API specs.
 *
 * @module utils/pagination
 */

export const DEFAULT_PAGE_SIZE = 10;
export const DEFAULT_PAGE = 1;
export const MAX_PAGE_SIZE = 100;

/**
 * Extracts and sanitizes pagination and sorting query parameters.
 *
 * @param {object} query - Express req.query object
 * @param {object} options
 * @param {number} [options.defaultLimit=10]
 * @param {number} [options.maxLimit=100]
 * @param {string[]} [options.allowedSortFields=['createdAt']]
 * @param {string} [options.defaultSortBy='createdAt']
 * @param {string} [options.defaultSortOrder='desc']
 * @returns {{ page: number, limit: number, skip: number, sortBy: string, sortOrder: string, sortObj: object }}
 */
export function parsePaginationParams(query = {}, options = {}) {
  const defaultLimit = options.defaultLimit || DEFAULT_PAGE_SIZE;
  const maxLimit = options.maxLimit || MAX_PAGE_SIZE;
  const allowedSortFields = options.allowedSortFields || ['createdAt'];
  const defaultSortBy = options.defaultSortBy || 'createdAt';
  const defaultSortOrder = options.defaultSortOrder || 'desc';

  // 1. Sanitize Page
  const rawPage = parseInt(query.page, 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : DEFAULT_PAGE;

  // 2. Sanitize Limit
  const rawLimit = parseInt(query.limit, 10);
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, maxLimit)
      : defaultLimit;

  const skip = (page - 1) * limit;

  // 3. Sanitize Sort
  let sortBy = defaultSortBy;
  if (query.sortBy && typeof query.sortBy === 'string' && allowedSortFields.includes(query.sortBy)) {
    sortBy = query.sortBy;
  }

  let sortOrder = defaultSortOrder;
  if (query.sortOrder === 'asc' || query.sortOrder === '1' || query.sort === 'asc') {
    sortOrder = 'asc';
  } else if (query.sortOrder === 'desc' || query.sortOrder === '-1' || query.sort === 'desc') {
    sortOrder = 'desc';
  }

  const sortDirection = sortOrder === 'asc' ? 1 : -1;
  const sortObj = { [sortBy]: sortDirection, _id: -1 };

  return {
    page,
    limit,
    skip,
    sortBy,
    sortOrder,
    sortObj,
  };
}

/**
 * Builds standardized pagination metadata object.
 *
 * @param {object} params
 * @param {number} params.page - Current page number
 * @param {number} params.limit - Current page size
 * @param {number} params.totalRecords - Total count of matching records in database
 * @returns {object} Standard pagination metadata
 */
export function buildPaginationMeta({ page, limit, totalRecords = 0 }) {
  const safeTotal = Math.max(0, Number(totalRecords) || 0);
  const totalPages = safeTotal > 0 ? Math.ceil(safeTotal / limit) : 0;

  return {
    currentPage: page,
    pageSize: limit,
    totalRecords: safeTotal,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1 && totalPages > 0 && page <= totalPages + 1,
    nextPage: page < totalPages ? page + 1 : null,
    previousPage: page > 1 ? (totalPages > 0 ? Math.min(page - 1, totalPages) : null) : null,
  };
}

/**
 * Standardizes paginated API response output.
 *
 * @param {object} options
 * @param {object} options.req - Express request object
 * @param {Array} options.data - Paginated records array
 * @param {number} options.totalRecords - Total records in database
 * @param {number} options.page - Current page
 * @param {number} options.limit - Current limit
 * @param {object} [options.extra={}] - Additional top-level fields (e.g. stats, filters)
 * @returns {object} Formatted JSON payload
 */
export function formatPaginatedResponse({ req, data = [], totalRecords = 0, page, limit, extra = {} }) {
  const pagination = buildPaginationMeta({ page, limit, totalRecords });

  return {
    success: true,
    requestId: req?.id,
    data,
    pagination,
    // Backwards-compatible top-level keys
    total: totalRecords,
    count: data.length,
    page,
    totalPages: pagination.totalPages,
    ...extra,
  };
}
