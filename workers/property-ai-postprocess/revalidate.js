const REQUEST_TIMEOUT_MS = 5000
const RETRY_DELAY_MS = 1000
const REVALIDATE_PATH = "/api/internal/property-revalidate"

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Tells the imotko web app to drop its cached pages for a property after the worker wrote it. The write already
 * happened, so this never rejects: it makes one retry on a 5xx or a network failure, then gives up and logs only
 * the property id, status code, error name and cause code (never the message, which can carry the URL or the secret).
 *
 * @param {{ webUrl: string, internalSecret: string, fetchImpl?: typeof fetch, sleep?: (ms: number) => Promise<void>,
 *   logger?: { error: (event: string, fields: object) => void } }} options
 * @returns {({ propertyId, previousSlug }: { propertyId: string, previousSlug?: string }) => Promise<void>}
 */
export function createWebRevalidator({ webUrl, internalSecret, fetchImpl = fetch, sleep = wait, logger }) {
    const log = fields => {
        try {
            logger?.error("property_revalidate_failed", fields)
        } catch {
            // Logging must never turn a finished write into a failure.
        }
    }

    // true = done (or not worth retrying), false = retry
    const attempt = async (body, propertyId, number) => {
        try {
            const response = await fetchImpl(`${webUrl}${REVALIDATE_PATH}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Imotko-Internal-Secret": internalSecret },
                body,
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            })
            if (response.ok) return true
            log({ propertyId, attempt: number, status: response.status })
            return response.status < 500
        } catch (error) {
            const causeCode = error?.cause?.code
            log({ propertyId, attempt: number, errorCode: error?.name || "unknown", ...(causeCode ? { causeCode } : {}) })
            return false
        }
    }

    return async ({ propertyId, previousSlug }) => {
        const body = JSON.stringify({ propertyId, ...(previousSlug ? { previousSlug } : {}) })
        if (await attempt(body, propertyId, 1)) return
        await sleep(RETRY_DELAY_MS)
        await attempt(body, propertyId, 2)
    }
}
