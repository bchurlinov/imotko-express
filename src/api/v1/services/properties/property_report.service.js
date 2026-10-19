import { PropertyReportReason, PropertyStatus } from "#generated/prisma/enums.ts"
import prisma from "#database/client.js"
import { ChatError } from "#services/chat/chat_error.js"

export const PROPERTY_REPORT_MESSAGE_MAX_LENGTH = 500

// Lowercase codes on the wire, enum values in the database.
export const PROPERTY_REPORT_REASONS = Object.freeze(
    Object.fromEntries(Object.values(PropertyReportReason).map(value => [value.toLowerCase(), value]))
)

export const PROPERTY_REPORT_ERRORS = Object.freeze({
    NOT_FOUND: "propertyNotFound",
    CANNOT_REPORT_OWN: "cannotReportOwnListing",
})

const normalizeMessage = message => {
    const trimmed = typeof message === "string" ? message.trim().slice(0, PROPERTY_REPORT_MESSAGE_MAX_LENGTH) : ""
    return trimmed || null
}

/**
 * Flags a listing for moderation. A second report by the same user on the same listing, while the first is still open,
 * updates that report instead of adding another row.
 * @param {{ propertyId: string, reporterUserId: string, reason: string, message?: string | null }} input
 * @returns {Promise<{ id: string, reason: string, updated: boolean }>}
 */
export const reportProperty = async ({ propertyId, reporterUserId, reason, message }) => {
    const property = await prisma.property.findUnique({
        where: { id: propertyId },
        select: { id: true, status: true, client: { select: { userId: true } } },
    })
    if (!property || property.status === PropertyStatus.DELETED)
        throw new ChatError(PROPERTY_REPORT_ERRORS.NOT_FOUND, 404)
    if (property.client?.userId && property.client.userId === reporterUserId) {
        throw new ChatError(PROPERTY_REPORT_ERRORS.CANNOT_REPORT_OWN, 403)
    }

    const data = { reason: PROPERTY_REPORT_REASONS[reason], message: normalizeMessage(message) }
    const open = await prisma.propertyReport.findFirst({
        where: { propertyId, reporterUserId, resolvedAt: null },
        select: { id: true },
    })
    if (open) {
        const report = await prisma.propertyReport.update({ where: { id: open.id }, data, select: { id: true } })
        return { id: report.id, reason, updated: true }
    }

    const report = await prisma.propertyReport.create({
        data: { ...data, propertyId, reporterUserId },
        select: { id: true },
    })
    return { id: report.id, reason, updated: false }
}
