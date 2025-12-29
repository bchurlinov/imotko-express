/**
 * Allowed fields to return in agency response
 * These fields are safe to expose publicly via the website configuration API
 */
export const ALLOWED_AGENCY_FIELDS = [
    "id",
    "name",
    "logo",
    "social",
    "description",
    "address",
    "location",
    "email",
    "phone",
    "websiteSettings",
    "testimonials",
]

/**
 * Standardized error response constants
 * Ensures consistent error messaging across the API
 */
export const ErrorResponses = {
    FORBIDDEN_REFERER: { code: 403, message: "forbiddenReferer" },
    AGENCY_NOT_FOUND: { code: 404, message: "agencyNotFound" },
    INTERNAL_ERROR: { code: 500, message: "somethingWentWrong" },
}
