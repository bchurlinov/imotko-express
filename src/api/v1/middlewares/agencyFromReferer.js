import { getAgencyWebsiteConfiguration } from "#services/website/website.service.js"
import { asyncHandler } from "#utils/helpers/async_handler.js"

export const attachAgencyFromReferer = asyncHandler(async (req, res, next) => {
    const referer = req.get("referer") || req.get("referrer")
    const origin = req.get("origin")
    const userAgent = req.get("user-agent")
    const ip = req.ip

    const result = await getAgencyWebsiteConfiguration(referer, origin, userAgent, ip)

    if (!result.success) {
        const code = result.error?.code ?? 403
        const message = result.error?.message ?? result.data?.message ?? "forbiddenReferer"
        return res.status(code).json({
            data: undefined,
            code,
            message,
        })
    }

    const agency = result.data
    if (process.env.NODE_ENV !== "production" && process.env.FAKE_EMAIL) agency.email = process.env.FAKE_EMAIL

    req.agency = agency
    req.agencyId = agency.id || null
    next()
})
