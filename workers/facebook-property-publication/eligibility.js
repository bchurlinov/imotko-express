import { selectLargePhotoUrls } from "./message.js"

const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value)

const hasNonEmptyString = value => typeof value === "string" && value.trim().length > 0

const hasMk = value => isRecord(value) && hasNonEmptyString(value.mk)

const isValidDate = value => value instanceof Date && !Number.isNaN(value.getTime())

const getExpiryState = (value, now) => {
    if (value === null || value === undefined) return "current"
    if (!isValidDate(value)) return "invalid"
    return value <= now ? "expired" : "current"
}

const invalidConnection = (reason, connectionStatus) => ({
    eligible: false,
    reason,
    connectionStatus,
    errorCode: reason,
})

export function evaluatePublicationEligibility(property, agencyId, now = new Date()) {
    if (!isRecord(property)) return { eligible: false, reason: "property-not-found" }
    if (property.agencyId !== agencyId) return { eligible: false, reason: "agency-mismatch" }
    if (property.status !== "PUBLISHED") return { eligible: false, reason: "property-not-published" }
    if (property.publishToFacebook !== true) return { eligible: false, reason: "consent-removed" }
    if (property.facebookPublishedAt !== null) return { eligible: false, reason: "already-published" }
    if (!hasNonEmptyString(property.slug)) return { eligible: false, reason: "missing-slug" }
    if (!hasMk(property.name)) return { eligible: false, reason: "missing-macedonian-name" }
    if (!hasMk(property.description)) return { eligible: false, reason: "missing-macedonian-description" }
    if (!["for_sale", "for_rent"].includes(property.listingType)) {
        return { eligible: false, reason: "invalid-listing-type" }
    }
    if (selectLargePhotoUrls(property.photos).length === 0) return { eligible: false, reason: "missing-photos" }

    const connection = property.agency?.facebookConnection
    if (!isRecord(connection) || connection.status !== "CONNECTED") {
        return { eligible: false, reason: "page-disconnected" }
    }
    if (!hasNonEmptyString(connection.pageId) || !hasNonEmptyString(connection.encryptedPageToken)) {
        return { eligible: false, reason: "missing-page-credentials" }
    }

    const pageTokenExpiry = getExpiryState(connection.pageTokenExpiresAt, now)
    if (pageTokenExpiry === "invalid") return invalidConnection("invalid-page-token-expiry", "ERROR")
    if (pageTokenExpiry === "expired") return invalidConnection("page-token-expired", "EXPIRED")

    const dataAccessExpiry = getExpiryState(connection.dataAccessExpiresAt, now)
    if (dataAccessExpiry === "invalid") return invalidConnection("invalid-data-access-expiry", "ERROR")
    if (dataAccessExpiry === "expired") return invalidConnection("data-access-expired", "EXPIRED")

    const grantedScopes = Array.isArray(connection.grantedScopes) ? connection.grantedScopes : []
    if (!["pages_manage_posts", "pages_read_engagement"].every(scope => grantedScopes.includes(scope))) {
        return invalidConnection("missing-page-scope", "ERROR")
    }

    const pageTasks = Array.isArray(connection.pageTasks) ? connection.pageTasks : []
    if (!["CREATE_CONTENT", "MANAGE"].some(task => pageTasks.includes(task))) {
        return invalidConnection("missing-page-task", "ERROR")
    }

    return { eligible: true }
}

export function isPublicationGuardCurrent(initialConnection, property, agencyId, now = new Date()) {
    if (!isRecord(initialConnection) || !isValidDate(now)) return false
    if (!evaluatePublicationEligibility(property, agencyId, now).eligible) return false

    const current = property.agency?.facebookConnection
    return (
        isRecord(current) &&
        hasNonEmptyString(initialConnection.pageId) &&
        Number.isInteger(initialConnection.revision) &&
        current.pageId === initialConnection.pageId &&
        current.revision === initialConnection.revision
    )
}
