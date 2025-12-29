import { ALLOWED_AGENCY_FIELDS } from "./constants.js"

/**
 * Filters agency data to only include allowed fields
 *
 * @param {Object} agency - The agency object to filter
 * @returns {Object} Filtered agency object with only allowed fields
 *
 * @example
 * const filtered = filterAgencyData(agency);
 */
export function filterAgencyData(agency) {
    if (!agency) return null

    const filtered = {}
    for (const field of ALLOWED_AGENCY_FIELDS) {
        if (field in agency) {
            filtered[field] = agency[field]
        }
    }
    return filtered
}
