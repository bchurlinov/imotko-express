import { FacebookApiError, RetryablePublicationError } from "./errors.js"

const GRAPH_BASE_URL = "https://graph.facebook.com"
const TRACE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/

const integerOrNull = value => (Number.isSafeInteger(value) ? value : null)

const traceIdOrNull = value => (typeof value === "string" && TRACE_ID_PATTERN.test(value) ? value : null)

const connectionStatusFor = error => {
    const code = integerOrNull(error?.code)
    const subcode = integerOrNull(error?.error_subcode)

    if (code === 190 && subcode === 458) return "REVOKED"
    if (code === 190 && subcode === 463) return "EXPIRED"
    if (code === 190 || code === 10 || code === 200) return "ERROR"
    return null
}

const errorDetailsFor = (response, error) => {
    const metaCode = integerOrNull(error?.code)
    const metaSubcode = integerOrNull(error?.error_subcode)
    const status = integerOrNull(response?.status)

    return {
        errorCode: `meta-${metaCode ?? status ?? "unknown"}`,
        metaCode,
        metaSubcode,
        fbtraceId: traceIdOrNull(error?.fbtrace_id),
    }
}

const retryableError = (message, details) => new RetryablePublicationError(message, details)

export function createFacebookClient({
    fetchImpl = fetch,
    graphApiVersion,
    timeoutMs,
    setTimeoutImpl = setTimeout,
    clearTimeoutImpl = clearTimeout,
}) {
    const request = async (path, fields) => {
        const controller = new AbortController()
        let response
        let receivedResponse = false
        let timeout

        const timeoutError = new Error("Facebook request timed out")
        timeoutError.name = "AbortError"

        const timeoutPromise = new Promise((_, reject) => {
            timeout = setTimeoutImpl(() => {
                controller.abort()
                reject(timeoutError)
            }, timeoutMs)
        })

        try {
            response = await Promise.race([
                fetchImpl(`${GRAPH_BASE_URL}/${graphApiVersion}/${path}`, {
                    method: "POST",
                    body: new URLSearchParams(fields),
                    signal: controller.signal,
                }),
                timeoutPromise,
            ])
            receivedResponse = true
            const payload = await Promise.race([response.json(), timeoutPromise])

            if (!response.ok || payload?.error) {
                const meta = payload?.error
                const details = errorDetailsFor(response, meta)
                const connectionStatus = connectionStatusFor(meta)

                if (connectionStatus && response.status !== 408 && response.status !== 429 && response.status < 500) {
                    throw new FacebookApiError("Facebook Page authorization failed", { ...details, connectionStatus })
                }

                throw retryableError("Facebook Graph API request failed", details)
            }

            const id = payload?.id
            if (typeof id !== "string" || !id.trim()) {
                throw retryableError("Facebook Graph API response did not contain an ID", {
                    errorCode: "missing-facebook-id",
                })
            }
            return id
        } catch (error) {
            if (error instanceof FacebookApiError || error instanceof RetryablePublicationError) throw error

            if (error?.name === "AbortError") {
                throw retryableError("Facebook request timed out", { errorCode: "timeout" })
            }

            throw retryableError(receivedResponse ? "Facebook response was invalid" : "Facebook request failed", {
                errorCode: receivedResponse ? "invalid-json" : "network",
            })
        } finally {
            clearTimeoutImpl(timeout)
        }
    }

    return {
        uploadUnpublishedPhoto: ({ pageId, imageUrl, accessToken }) =>
            request(`${encodeURIComponent(pageId)}/photos`, {
                url: imageUrl,
                published: "false",
                access_token: accessToken,
            }),

        createPagePost: ({ pageId, message, photoIds, accessToken }) =>
            request(`${encodeURIComponent(pageId)}/feed`, {
                message,
                attached_media: JSON.stringify(photoIds.map(media_fbid => ({ media_fbid }))),
                published: "true",
                access_token: accessToken,
            }),
    }
}
