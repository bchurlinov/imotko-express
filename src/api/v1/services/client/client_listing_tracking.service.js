import prisma from "#database/client.js"
import { getIpAddress } from "#utils/auth/ip_address.js"
import { backfillUserLocationFromListing, trackListingSubmitted } from "#shared/analytics/listing_conversions.js"

// The app has no Meta browser cookies or page url, so Meta matches on the hashed email and the ip / user agent.
export const readExpressRequestContext = req => ({
    fbp: null,
    fbc: null,
    clientIpAddress: getIpAddress(req),
    clientUserAgent: req.get?.("user-agent") || null,
    eventSourceUrl: null,
})

// Runs after the response (design: owner listing conversion §5.3). It never rejects: a tracking or location failure
// must not touch the 201 the app already got.
export const afterClientListingCreated = async (
    { property, userId, clientId, city, req },
    { db = prisma, track = trackListingSubmitted, backfill = backfillUserLocationFromListing } = {}
) => {
    try {
        const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true } })
        if (user) {
            track({ property, user, requestContext: readExpressRequestContext(req), actionSource: "system_generated" })
        }
        await db.$transaction(tx => backfill(tx, { userId, clientId, city }))
    } catch (error) {
        console.error("[CLIENT_LISTING_TRACKING] failed", error)
    }
}

// Like scheduleAiPostprocess: the work starts on the next tick, after the response is sent.
export const scheduleClientListingConversions = (args, { run = afterClientListingCreated, defer = setImmediate } = {}) => {
    defer(() => {
        try {
            Promise.resolve(run(args)).catch(error => console.error("[CLIENT_LISTING_TRACKING] scheduling failed", error))
        } catch (error) {
            console.error("[CLIENT_LISTING_TRACKING] scheduling failed", error)
        }
    })
}
