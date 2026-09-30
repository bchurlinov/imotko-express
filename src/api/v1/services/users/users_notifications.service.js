import prisma from "#database/client.js"
import createError from "http-errors"

/**
 * Get all notifications for a specific user
 * @param {string} userId - The ID of the user whose notifications to retrieve
 * @returns {Promise<{data: import('@prisma/client').Notification[], message: string}>} Promise resolving to an object containing the notifications array and success message
 * @throws {Error} Throws any database errors that occur during the query
 */
export const getUserNotificationsService = async (userId, actor) => {
    try {
        if (actor?.type !== "admin" && actor?.userId !== userId) throw createError(403, "Forbidden")
        const notifications = await prisma.notification.findMany({
            where: { recipientId: userId },
            orderBy: { createdAt: "desc" },
        })
        return {
            data: notifications,
            message: "User notifications loaded successfully.",
        }
    } catch (err) {
        throw err
    }
}

/**
 * Update the status of one or more notifications
 * @param {string[]} notificationIds - Array of notification IDs to update
 * @param {string} status - The current status; will be toggled to the opposite value
 * @returns {Promise<{data: {count: number}, message: string}>} Promise resolving to an object containing the update count and success message
 * @throws {Error} Throws any database errors that occur during the query
 */
export const patchNotificationStatusService = async (notificationIds, status, recipientId) => {
    try {
        const result = await prisma.notification.updateMany({
            where: { id: { in: notificationIds }, recipientId },
            data: { status },
        })
        return {
            data: result,
            message: "Notification status updated successfully.",
        }
    } catch (err) {
        throw err
    }
}

/**
 * Get all notifications for a specific user
 * @param {string} notificationId - The ID of notification that needs to be updated
 * @returns {Promise<{message: string}>} Promise resolving to an object containing success message
 * @throws {Error} Throws any database errors that occur during the query
 */
export const deleteNotificationsService = async (notificationId, recipientId) => {
    try {
        await prisma.notification.deleteMany({ where: { id: notificationId, recipientId } })
        return {
            data: null,
            message: "Notification deleted successfully.",
        }
    } catch (err) {
        throw err
    }
}
