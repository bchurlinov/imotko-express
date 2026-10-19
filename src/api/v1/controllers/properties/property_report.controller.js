import { chatResponse } from "#controllers/chat/chat_response.js"
import { reportProperty } from "#services/properties/property_report.service.js"

/**
 * POST /properties/:id/report — a signed-in user flags a listing for the moderation team.
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>}
 */
export const reportPropertyController = async (req, res) => {
    const report = await reportProperty({
        propertyId: req.params.id,
        reporterUserId: req.chatUser.id,
        reason: req.body.reason,
        message: req.body.message,
    })
    return chatResponse(res, report.updated ? 200 : 201, "reportSent", { id: report.id })
}
