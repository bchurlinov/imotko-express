/**
 * @typedef {Object} PaginationMeta
 * @property {number} currentPage - Current page number
 * @property {number} pageSize - Number of items per page
 * @property {number} totalPages - Total number of pages
 * @property {number} total - Total number of items
 * @property {boolean} hasMore - Whether there are more pages
 */

/**
 * @template T
 * @typedef {Object} ApiResponse
 * @property {string} message - Response message
 * @property {T} data - Response data
 * @property {PaginationMeta} [pagination] - Optional pagination metadata
 */

// Export empty object to make this a module
export {}
