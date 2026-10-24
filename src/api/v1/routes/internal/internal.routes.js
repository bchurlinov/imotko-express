import { timingSafeEqual } from "node:crypto"
import express from "express"
import { invalidateCachePattern } from "#utils/cache/invalidation.js"
import { isTrustedInternalCaller } from "#middlewares/rateLimitKey.js"
import {
    enqueueFacebookPublication,
    parseFacebookPublicationRequest,
} from "#services/properties/facebook_publication_queue.service.js"

const router = express.Router()

export const isValidRevalidateSecret = (provided, expected) => {
    if (!provided || !expected) return false
    const a = Buffer.from(provided)
    const b = Buffer.from(expected)
    return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Called by imotko (Next) after it writes agency website data directly to the DB,
 * so the in-memory getAgencyByReferer cache doesn't serve the old config to the templates refetch.
 */
router.post("/agency-cache/invalidate", (req, res) => {
    if (!isValidRevalidateSecret(req.get("x-revalidate-secret"), process.env.REVALIDATE_SECRET)) {
        return res.status(401).json({ message: "Unauthorized" })
    }
    invalidateCachePattern("cache:getAgencyByReferer:")
    return res.status(204).end()
})

/**
 * Handler for imotko (Next) asking for a Facebook publication job after a property save.
 * Authenticated with INTERNAL_API_SECRET, which only our own servers have; with it unset every call is rejected.
 * The job id is per property revision, so a retried call does not publish twice.
 *
 * @param {{ enqueue?: typeof enqueueFacebookPublication, isTrusted?: typeof isTrustedInternalCaller }} [deps]
 * @returns {import('express').RequestHandler}
 */
export const createFacebookPublicationHandler =
    ({ enqueue = enqueueFacebookPublication, isTrusted = isTrustedInternalCaller } = {}) =>
    async (req, res) => {
        if (!isTrusted(req)) return res.status(401).json({ message: "Unauthorized" })

        const request = parseFacebookPublicationRequest(req.body)
        if (!request) return res.status(400).json({ message: "Invalid request" })

        try {
            const job = await enqueue(request)
            return res.status(202).json({ jobId: job?.id ?? null })
        } catch (error) {
            console.error("[facebookPublication] enqueue failed", request.propertyId, error?.message || error)
            return res.status(503).json({ message: "Queue unavailable" })
        }
    }

router.post("/facebook-publication", createFacebookPublicationHandler())

export default router
