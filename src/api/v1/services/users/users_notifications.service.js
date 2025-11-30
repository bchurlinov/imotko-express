import prisma from "#database/client.js"
import { NotificationStatus } from "@prisma/client"

/**
 * Get all notifications for a specific user
 * @param {string} userId - The ID of the user whose notifications to retrieve
 * @returns {Promise<{data: import('@prisma/client').Notification[], message: string}>} Promise resolving to an object containing the notifications array and success message
 * @throws {Error} Throws any database errors that occur during the query
 */
export const getUserNotificationsService = async userId => {
    try {
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
 * Get all notifications for a specific user
 * @param {string} notificationId - The ID of notification that needs to be updated
 * @param {string} status - The new status to set for the notification
 * @returns {Promise<{data: import('@prisma/client').Notification, message: string}>} Promise resolving to an object containing the notification and success message
 * @throws {Error} Throws any database errors that occur during the query
 */
export const patchNotificationStatusService = async (notificationId, status) => {
    try {
        const nextStatus = status === NotificationStatus.UNREAD ? NotificationStatus.READ : NotificationStatus.UNREAD
        const updatedNotification = await prisma.notification.update({
            where: { id: notificationId },
            data: { status: nextStatus },
        })
        return {
            data: updatedNotification,
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
export const deleteNotificationsService = async notificationId => {
    try {
        await prisma.notification.delete({
            where: { id: notificationId },
        })
        return {
            data: null,
            message: "Notification deleted successfully.",
        }
    } catch (err) {
        throw err
    }
}
