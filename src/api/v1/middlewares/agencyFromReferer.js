import { getAgencyWebsiteConfiguration } from "#services/website/website.service.js"
import { asyncHandler } from "#utils/helpers/async_handler.js"

export const attachAgencyFromReferer = asyncHandler(async (req, res, next) => {
    const referer = req.get("referer") || req.get("referrer")
    const origin = req.get("origin")
    const userAgent = req.get("user-agent")
    const ip = req.ip

    const result = await getAgencyWebsiteConfiguration(referer, origin, userAgent, ip)

    if (!result.success) {
        return res.status(result.error.code).json({
            data: undefined,
            code: result.error.code,
            message: result.error.message,
        })
    }

    req.agencyId = result.data.id
    next()
})
