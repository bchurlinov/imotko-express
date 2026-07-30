/**
 * Agencies that must never surface through the public API.
 * Their properties and agency records are filtered out of the
 * properties and agencies services.
 */
export const HIDDEN_AGENCY_IDS = ["cms1rl5jy000g04jvt07flhf7"]

/**
 * Check whether an agency is hidden from public listings
 * @param {string|null|undefined} agencyId
 * @returns {boolean}
 */
export const isHiddenAgency = agencyId => !!agencyId && HIDDEN_AGENCY_IDS.includes(agencyId)
