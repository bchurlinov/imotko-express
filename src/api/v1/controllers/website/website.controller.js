import { asyncHandler } from "#utils/helpers/async_handler.js"
import { getAgencyWebsiteConfiguration } from "#services/website/website.service.js"
import { getPropertiesService, getPropertyService } from "#services/properties/properties.service.js"

/**
 * Controller to get agency website configuration based on referer header
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
export const agencyWebsiteConfigurationController = asyncHandler(async (req, res) => {
    // Extract headers
    const referer = req.get("referer") || req.get("referrer")
    const origin = req.get("origin")
    const userAgent = req.get("user-agent")
    const ip = req.ip

    // Call service layer for authorization and data retrieval
    const result = await getAgencyWebsiteConfiguration(referer, origin, userAgent, ip)

    // Handle result based on success/failure
    if (result.success) {
        return res.status(200).json({
            data: result.data,
            code: 200,
            message: "Agency configuration loaded successfully.",
        })
    } else {
        // Return error response
        return res.status(result.error.code).json({
            data: undefined,
            code: result.error.code,
            message: result.error.message,
        })
    }
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
