const ALLOWED_FIELDS = new Set([
    "jobId",
    "campaignId",
    "jobName",
    "propertyId",
    "agencyId",
    "connectionId",
    "attempt",
    "photoIndex",
    "durationMs",
    "reason",
    "status",
    "errorCode",
    "metaCode",
    "metaSubcode",
    "fbtraceId",
    "facebookPostId",
    "persistenceOutcome",
])

const sanitize = fields =>
    Object.fromEntries(Object.entries(fields || {}).filter(([key, value]) => ALLOWED_FIELDS.has(key) && value != null))

/**
 * Log fields for a Redis/BullMQ error. A Redis ReplyError's message is the server's reply ("NOAUTH ...",
 * "ERR max requests limit exceeded ...") and never echoes credentials, so it is kept as `reason`; other
 * errors only log their name, as before.
 *
 * @param {unknown} error
 * @returns {{ errorCode: string, reason?: string }}
 */
export const redisErrorFields = error => ({
    errorCode: error?.name || "unknown",
    ...(error?.name === "ReplyError" && typeof error.message === "string"
        ? { reason: error.message.slice(0, 160) }
        : {}),
})

export function createLogger(output = console) {
    const write = (method, event, fields) =>
        output[method](
            JSON.stringify({
                timestamp: new Date().toISOString(),
                level: method === "error" ? "error" : "info",
                event,
                ...sanitize(fields),
            })
        )

    return {
        info: (event, fields = {}) => write("log", event, fields),
        error: (event, fields = {}) => write("error", event, fields),
    }
}
