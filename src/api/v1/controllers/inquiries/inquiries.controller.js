import { asyncHandler } from "#utils/helpers/async_handler.js"
import { postContactRequestService } from "#services/inquiries/inquiries.service.js"

/**
 * Controller to handle public mobile contact request submissions
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>}
 */
export const postContactRequestController = asyncHandler(async (req, res) => {
    const result = await postContactRequestService(req.body)

    if (!result.success) {
        return res.status(result.error.code).json({
            code: result.error.code,
            message: result.error.message,
        })
    }

    return res.status(200).json({
        code: 200,
        message: "Contact request submitted successfully",
        data: null,
    })
})
