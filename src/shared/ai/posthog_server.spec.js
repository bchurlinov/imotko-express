import assert from "node:assert/strict"
import test from "node:test"
import { captureServerEvent, setPosthogServerClientForTests } from "./posthog_server.js"

const fakeClient = () => {
    const calls = { capture: [], flush: 0 }
    return {
        calls,
        capture: payload => calls.capture.push(payload),
        flush: async () => {
            calls.flush += 1
        },
    }
}

test("no-ops without a client", () => {
    setPosthogServerClientForTests(null)

    assert.equal(captureServerEvent({ distinctId: "u1", event: "client_listing_submitted" }), undefined)
})

test("captures the event with the api surface and flushes in the background", () => {
    const client = fakeClient()
    setPosthogServerClientForTests(client)

    captureServerEvent({ distinctId: "u1", event: "client_listing_submitted", properties: { a: 1 } })

    assert.deepEqual(client.calls.capture, [
        { distinctId: "u1", event: "client_listing_submitted", properties: { app_surface: "api", a: 1 } },
    ])
    assert.equal(client.calls.flush, 1)
})

test("ignores events without a distinct id", () => {
    const client = fakeClient()
    setPosthogServerClientForTests(client)

    captureServerEvent({ distinctId: "", event: "x" })

    assert.equal(client.calls.capture.length, 0)
})
