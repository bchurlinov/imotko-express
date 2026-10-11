import { timingSafeEqual } from "node:crypto"
import express from "express"
import { invalidateCachePattern } from "#utils/cache/invalidation.js"

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

export default router
