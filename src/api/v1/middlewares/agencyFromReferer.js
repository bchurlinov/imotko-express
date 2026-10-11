import { getAgencyWebsiteConfiguration } from "#services/website/website.service.js"
import { getAgencyById, isAllowedReferrer } from "#services/website/utils/index.js"
import { normalizeUrl } from "#utils/url/normalizeUrl.js"
import { asyncHandler } from "#utils/helpers/async_handler.js"

const DEV_AGENCY_HEADER = "x-dev-agency-id"

const applyFakeEmail = agency => {
    if (process.env.NODE_ENV !== "production" && process.env.FAKE_EMAIL) agency.email = process.env.FAKE_EMAIL
}

/**
 * Local-development override: a website running on localhost may name the agency to load with the
 * `X-Dev-Agency-Id` header instead of matching `social.website` against the referer.
 *
 * Active only when ENV=development (and never under NODE_ENV=production), and only for an allowed
 * localhost referer. In every other environment the header is ignored and the normal referer lookup runs.
 */
const resolveDevAgency = async req => {
    const agencyId = req.get(DEV_AGENCY_HEADER)
    if (!agencyId) return null
    if (process.env.ENV !== "development" || process.env.NODE_ENV === "production") return null

    const referer = req.get("referer") || req.get("referrer")
    if (!referer || !isAllowedReferrer(referer) || normalizeUrl(referer) !== "localhost") return null

    return getAgencyById(agencyId.trim())
}

export const attachAgencyFromReferer = asyncHandler(async (req, res, next) => {
    const referer = req.get("referer") || req.get("referrer")
    const origin = req.get("origin")
    const userAgent = req.get("user-agent")
    const ip = req.ip

    const devAgency = await resolveDevAgency(req)
    if (devAgency) {
        applyFakeEmail(devAgency)
        req.agency = devAgency
        req.agencyId = devAgency.id
        return next()
    }

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
    applyFakeEmail(agency)

    req.agency = agency
    req.agencyId = agency.id || null
    next()
})
