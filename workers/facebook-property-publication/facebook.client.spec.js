import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { FacebookApiError, RetryablePublicationError } from "./errors.js"
import { createFacebookClient } from "./facebook.client.js"

const response = (status, body) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
    })

const photoInput = {
    pageId: "page-1",
    imageUrl: "https://images.example/1.jpg",
    accessToken: "token",
}

describe("Facebook client", () => {
    test("uploads an unpublished photo with a form-encoded Page token", async () => {
        let request
        const client = createFacebookClient({
            graphApiVersion: "v24.0",
            timeoutMs: 30000,
            fetchImpl: async (url, options) => ((request = { url, options }), response(200, { id: "photo-1" })),
        })

        assert.equal(await client.uploadUnpublishedPhoto(photoInput), "photo-1")
        assert.equal(request.url, "https://graph.facebook.com/v24.0/page-1/photos")
        assert.equal(request.options.method, "POST")
        assert.ok(request.options.body instanceof URLSearchParams)
        assert.equal(request.options.body.get("url"), photoInput.imageUrl)
        assert.equal(request.options.body.get("published"), "false")
        assert.equal(request.options.body.get("access_token"), photoInput.accessToken)
    })

    test("creates the final post with ordered attached media", async () => {
        let request
        const client = createFacebookClient({
            graphApiVersion: "v24.0",
            timeoutMs: 30000,
            fetchImpl: async (url, options) => ((request = { url, options }), response(200, { id: "page-1_post-1" })),
        })

        const postId = await client.createPagePost({
            pageId: "page-1",
            message: "Порака",
            photoIds: ["photo-1", "photo-2"],
            accessToken: "token",
        })

        assert.equal(postId, "page-1_post-1")
        assert.equal(request.url, "https://graph.facebook.com/v24.0/page-1/feed")
        assert.equal(request.options.method, "POST")
        assert.deepEqual(JSON.parse(request.options.body.get("attached_media")), [
            { media_fbid: "photo-1" },
            { media_fbid: "photo-2" },
        ])
        assert.equal(request.options.body.get("message"), "Порака")
        assert.equal(request.options.body.get("published"), "true")
        assert.equal(request.options.body.get("access_token"), "token")
    })

    test("uses the configured timeout, aborts the request, and clears its timer", async () => {
        let delay
        let clearedTimer
        let capturedSignal
        const scheduled = new Map()
        let nextTimer = 0
        const client = createFacebookClient({
            graphApiVersion: "v24.0",
            timeoutMs: 30000,
            fetchImpl: async (_url, { signal }) => {
                capturedSignal = signal
                return await new Promise((_resolve, reject) => {
                    signal.addEventListener("abort", () => {
                        const error = new Error("request was aborted")
                        error.name = "AbortError"
                        reject(error)
                    })
                })
            },
            setTimeoutImpl: (callback, timeout) => {
                delay = timeout
                const timer = ++nextTimer
                scheduled.set(timer, callback)
                return timer
            },
            clearTimeoutImpl: timer => {
                clearedTimer = timer
                scheduled.delete(timer)
            },
        })

        const publishing = client.uploadUnpublishedPhoto(photoInput)
        await Promise.resolve()
        assert.equal(delay, 30000)
        assert.equal(capturedSignal.aborted, false)
        scheduled.get(1)()

        await assert.rejects(
            publishing,
            error =>
                error instanceof RetryablePublicationError &&
                error.errorCode === "timeout" &&
                !error.message.includes(photoInput.accessToken) &&
                !error.message.includes(photoInput.imageUrl)
        )
        assert.equal(clearedTimer, 1)
    })

    test("clears its timeout after a successful request", async () => {
        let clearedTimer
        const client = createFacebookClient({
            graphApiVersion: "v24.0",
            timeoutMs: 30000,
            fetchImpl: async () => response(200, { id: "photo-1" }),
            setTimeoutImpl: () => "timer-1",
            clearTimeoutImpl: timer => {
                clearedTimer = timer
            },
        })

        await client.uploadUnpublishedPhoto(photoInput)

        assert.equal(clearedTimer, "timer-1")
    })

    test("classifies expired, revoked, and permission errors as permanent sanitized connection failures", async () => {
        for (const [error, expectedStatus] of [
            [{ code: 190, error_subcode: 463 }, "EXPIRED"],
            [{ code: 190, error_subcode: 458 }, "REVOKED"],
            [{ code: 200 }, "ERROR"],
            [{ code: 10 }, "ERROR"],
        ]) {
            const client = createFacebookClient({
                graphApiVersion: "v24.0",
                timeoutMs: 30000,
                fetchImpl: async () =>
                    response(400, {
                        error: {
                            message: `Rejected ${photoInput.accessToken} ${photoInput.imageUrl}`,
                            fbtrace_id: "trace-1",
                            ...error,
                        },
                    }),
            })

            await assert.rejects(
                () => client.uploadUnpublishedPhoto(photoInput),
                value =>
                    value instanceof FacebookApiError &&
                    value.connectionStatus === expectedStatus &&
                    value.errorCode === `meta-${error.code}` &&
                    value.metaCode === error.code &&
                    value.fbtraceId === "trace-1" &&
                    !JSON.stringify(value).includes(photoInput.accessToken) &&
                    !JSON.stringify(value).includes(photoInput.imageUrl) &&
                    !value.message.includes(photoInput.accessToken) &&
                    !value.message.includes(photoInput.imageUrl)
            )
        }
    })

    test("classifies rate limits, server failures, non-JSON responses, and missing IDs as retryable", async () => {
        for (const fetchImpl of [
            async () => response(429, { error: { code: 4, message: "Rate limited" } }),
            async () => response(503, { error: { code: 2, message: "Unavailable" } }),
            async () => new Response("not json", { status: 502 }),
            async () => response(200, {}),
        ]) {
            const client = createFacebookClient({ graphApiVersion: "v24.0", timeoutMs: 30000, fetchImpl })
            await assert.rejects(
                () => client.uploadUnpublishedPhoto(photoInput),
                error =>
                    error instanceof RetryablePublicationError &&
                    !error.message.includes(photoInput.accessToken) &&
                    !error.message.includes(photoInput.imageUrl)
            )
        }
    })

    test("does not retain request secrets from network failures", async () => {
        const client = createFacebookClient({
            graphApiVersion: "v24.0",
            timeoutMs: 30000,
            fetchImpl: async () => {
                throw new Error(`failed for ${photoInput.accessToken} at ${photoInput.imageUrl}`)
            },
        })

        await assert.rejects(
            () => client.uploadUnpublishedPhoto(photoInput),
            error =>
                error instanceof RetryablePublicationError &&
                error.errorCode === "network" &&
                error.cause === undefined &&
                !JSON.stringify(error).includes(photoInput.accessToken) &&
                !JSON.stringify(error).includes(photoInput.imageUrl) &&
                !error.message.includes(photoInput.accessToken) &&
                !error.message.includes(photoInput.imageUrl)
        )
    })

    test("rejects whitespace-only response IDs as retryable", async () => {
        const client = createFacebookClient({
            graphApiVersion: "v24.0",
            timeoutMs: 30000,
            fetchImpl: async () => response(200, { id: "   " }),
        })

        await assert.rejects(
            () => client.uploadUnpublishedPhoto(photoInput),
            error => error instanceof RetryablePublicationError && error.errorCode === "missing-facebook-id"
        )
    })
})
