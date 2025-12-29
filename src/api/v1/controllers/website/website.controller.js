import { asyncHandler } from "#utils/helpers/async_handler.js"
import { getPropertiesService } from "#services/properties/properties.service.js"
import { postAgencyContactService } from "#services/website/website.service.js"

/**
 * Controller to get agency website configuration based on referer header
 * Note: The attachAgencyFromReferer middleware handles authorization and data retrieval
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
export const agencyWebsiteConfigurationController = asyncHandler(async (req, res) => {
    return res.status(200).json({
        data: req.agency,
        code: 200,
        message: "Agency configuration loaded successfully.",
    })
})

/**
 * Controller to get properties
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
export const getWebsiteAgencyPropertiesController = asyncHandler(async (req, res) => {
    const { f, ...otherParams } = req.query
    let decodedFilters = {}

    if (f) {
        try {
            const decodedString = Buffer.from(f, "base64").toString("utf-8")
            decodedFilters = JSON.parse(decodedString)
        } catch (error) {
            console.error("Error decoding filter parameter:", error)
        }
    }

    const queryParams = { agency: req.agencyId, ...otherParams, ...decodedFilters }
    const agencyProperties = await getPropertiesService(queryParams)
    return res.status(200).json(agencyProperties)
})

/**
 * Controller to handle agency contact form submission
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
export const postAgencyContactController = asyncHandler(async (req, res) => {
    const result = await postAgencyContactService(req.body, req.agency)

    if (!result.success) {
        return res.status(result.error.code).json({
            code: result.error.code,
            message: result.error.message,
        })
    }

    return res.status(200).json({
        code: 200,
        message: "Contact form submitted successfully",
        data: null,
        // data: result.data,
    })
})
