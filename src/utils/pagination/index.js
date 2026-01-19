/**
 * Default page size for pagination
 */
export const DEFAULT_PAGE_SIZE = 15

/**
 * Maximum allowed page size to prevent excessive data retrieval
 */
export const MAX_PAGE_SIZE = 500

/**
 * Convert value to positive integer
 * @param {string | number | undefined} value
 * @returns {number | undefined}
 */
const toPositiveInt = value => {
    if (value === undefined || value === null) return undefined
    const numeric = typeof value === "string" ? Number(value) : value
    if (!Number.isFinite(numeric) || numeric <= 0) return undefined
    return Math.floor(numeric)
}

/**
 * Calculate pagination parameters from request query
 * @param {object} options
 * @param {string | number | undefined} options.page - Requested page number
 * @param {string | number | undefined} options.limit - Requested page size
 * @param {number} options.total - Total number of records
 * @param {number} [options.defaultLimit=DEFAULT_PAGE_SIZE] - Default page size
 * @param {number} [options.maxLimit=MAX_PAGE_SIZE] - Maximum allowed page size
 * @returns {{page: number, limit: number, skip: number, totalPages: number}}
 */
export const calculatePagination = ({ page, limit, total, defaultLimit = DEFAULT_PAGE_SIZE, maxLimit = MAX_PAGE_SIZE }) => {
    // Calculate safe limit
    const requestedLimit = toPositiveInt(limit) ?? defaultLimit
    const safeLimit = Math.min(requestedLimit, maxLimit)

    // Calculate total pages
    const totalPages = safeLimit > 0 ? Math.ceil(total / safeLimit) : 0

    // Calculate and validate page number
    let requestedPage = toPositiveInt(page) ?? 1
    const safePage = Math.max(1, Math.min(requestedPage, totalPages || 1))

    // Calculate skip value for database query
    const skip = (safePage - 1) * safeLimit

    return {
        page: safePage,
        limit: safeLimit,
        skip,
        totalPages,
    }
}

/**
 * Create pagination response object
 * @param {object} options
 * @param {number} options.currentPage - Current page number
 * @param {number} options.pageSize - Number of items per page
 * @param {number} options.totalPages - Total number of pages
 * @param {number} options.total - Total number of records
 * @returns {{currentPage: number, pageSize: number, totalPages: number, total: number, hasMore: boolean}}
 */
export const createPaginationResponse = ({ currentPage, pageSize, totalPages, total }) => {
    return {
        currentPage,
        pageSize,
        totalPages,
        total,
        hasMore: currentPage < totalPages,
    }
}
