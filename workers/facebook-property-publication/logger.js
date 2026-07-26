const ALLOWED_FIELDS = new Set([
    "jobId",
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
