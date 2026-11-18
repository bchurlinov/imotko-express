import { createWebRevalidator } from "../../workers/property-ai-postprocess/revalidate.js"

const DEFAULT_WEB_URL = "https://imotko.mk"

const consoleLogger = { error: (event, fields) => console.error(`[notifyWebProperty] ${event}`, fields) }

/**
 * COST(B-04): the imotko web app now serves property pages from its ISR cache (revalidate 3600) instead of rendering
 * them on every visit. Writes made on the web already refresh the page; writes made here (mobile app) must tell it too,
 * or a deleted or hidden listing could stay visible for up to an hour. Calls the existing
 * POST /api/internal/property-revalidate with INTERNAL_API_SECRET, like the AI worker.
 *
 * Fire-and-forget: never throws (one retry on 5xx/network, then logs). A no-op while INTERNAL_API_SECRET is unset,
 * so deploying this without the env var changes nothing.
 *
 * @param {{ propertyId?: string, previousSlug?: string }} payload
 * @param {{ env?: NodeJS.ProcessEnv, fetchImpl?: typeof fetch, sleep?: (ms: number) => Promise<void>, logger?: object }} [deps]
 * @returns {Promise<void>}
 */
export async function notifyWebProperty({ propertyId, previousSlug } = {}, deps = {}) {
    const { env = process.env, fetchImpl = fetch, sleep, logger = consoleLogger } = deps
    const internalSecret = env.INTERNAL_API_SECRET
    if (!propertyId || !internalSecret) return

    try {
        const webUrl = (env.IMOTKO_WEB_URL || DEFAULT_WEB_URL).replace(/\/+$/, "")
        const revalidate = createWebRevalidator({ webUrl, internalSecret, fetchImpl, logger, ...(sleep ? { sleep } : {}) })
        await revalidate({ propertyId: String(propertyId), previousSlug })
    } catch (error) {
        console.error("[notifyWebProperty] unexpected", error?.name)
    }
}
