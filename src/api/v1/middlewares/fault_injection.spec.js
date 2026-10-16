import assert from "node:assert/strict"
import test from "node:test"
import express from "express"
import {
    createFaultInjection,
    FAULT_DELAY_HEADER,
    FAULT_HEADER,
    FAULT_MESSAGE_HEADER,
    isFaultInjectionEnabled,
} from "./fault_injection.js"

const ENABLED_ENV = { ENV: "development", ENABLE_FAULT_INJECTION: "true" }

// Same response shape as errorMiddleware.js, without its file logging.
const startApp = async env => {
    const app = express()
    app.use(createFaultInjection(env))
    app.get("/ok", (req, res) => res.json({ ok: true }))
    app.use((error, req, res, next) => {
        const status = error.status || 500
        res.status(status).json({ status, message: error.message, ...(error.errors && { errors: error.errors }) })
    })
    const server = await new Promise(resolve => {
        const listening = app.listen(0, "127.0.0.1", () => resolve(listening))
    })
    const baseUrl = `http://127.0.0.1:${server.address().port}`
    return { baseUrl, close: () => new Promise(resolve => server.close(resolve)) }
}

const silenceWarnings = t => t.mock.method(console, "warn", () => {})

test("only enabled with ENV=development and the opt-in flag", () => {
    assert.equal(isFaultInjectionEnabled(ENABLED_ENV), true)
    assert.equal(isFaultInjectionEnabled({ ENV: "development" }), false)
    assert.equal(isFaultInjectionEnabled({ ENV: "staging", ENABLE_FAULT_INJECTION: "true" }), false)
    assert.equal(isFaultInjectionEnabled({ ENV: "production", ENABLE_FAULT_INJECTION: "true" }), false)
    assert.equal(isFaultInjectionEnabled({ ...ENABLED_ENV, NODE_ENV: "production" }), false)
})

test("disabled: the header is ignored", async () => {
    const app = await startApp({ ENV: "production", ENABLE_FAULT_INJECTION: "true" })
    try {
        const response = await fetch(`${app.baseUrl}/ok`, { headers: { [FAULT_HEADER]: "500" } })
        assert.equal(response.status, 200)
        assert.deepEqual(await response.json(), { ok: true })
    } finally {
        await app.close()
    }
})

test("enabled: requests without the header pass through", async t => {
    silenceWarnings(t)
    const app = await startApp(ENABLED_ENV)
    try {
        const response = await fetch(`${app.baseUrl}/ok`)
        assert.equal(response.status, 200)
    } finally {
        await app.close()
    }
})

test("status faults go through the error handler, validation ones carry errors", async t => {
    silenceWarnings(t)
    const app = await startApp(ENABLED_ENV)
    try {
        const notFound = await fetch(`${app.baseUrl}/ok`, { headers: { [FAULT_HEADER]: "404" } })
        assert.equal(notFound.status, 404)
        assert.deepEqual(await notFound.json(), { status: 404, message: "Not Found" })

        const invalid = await fetch(`${app.baseUrl}/ok`, { headers: { [FAULT_HEADER]: "422" } })
        const body = await invalid.json()
        assert.equal(invalid.status, 422)
        assert.equal(body.message, "Проблем со валидирање на податоците.")
        assert.equal(body.errors[0].path, "email")
    } finally {
        await app.close()
    }
})

test("message override is URI-decoded", async t => {
    silenceWarnings(t)
    const app = await startApp(ENABLED_ENV)
    try {
        const response = await fetch(`${app.baseUrl}/ok`, {
            headers: { [FAULT_HEADER]: "500", [FAULT_MESSAGE_HEADER]: encodeURIComponent("Грешка на серверот") },
        })
        assert.deepEqual(await response.json(), { status: 500, message: "Грешка на серверот" })
    } finally {
        await app.close()
    }
})

test("429 mirrors the production rate limiter body", async t => {
    silenceWarnings(t)
    const app = await startApp(ENABLED_ENV)
    try {
        const response = await fetch(`${app.baseUrl}/ok`, { headers: { [FAULT_HEADER]: "429" } })
        assert.equal(response.status, 429)
        assert.deepEqual(await response.json(), { data: null, code: 429, message: "rateLimited" })
    } finally {
        await app.close()
    }
})

test("html, empty and drop faults", async t => {
    silenceWarnings(t)
    const app = await startApp(ENABLED_ENV)
    try {
        const html = await fetch(`${app.baseUrl}/ok`, { headers: { [FAULT_HEADER]: "html" } })
        assert.equal(html.status, 502)
        assert.match(html.headers.get("content-type"), /text\/html/)

        const empty = await fetch(`${app.baseUrl}/ok`, { headers: { [FAULT_HEADER]: "empty" } })
        assert.equal(empty.status, 500)
        assert.equal(await empty.text(), "")

        await assert.rejects(fetch(`${app.baseUrl}/ok`, { headers: { [FAULT_HEADER]: "drop" } }))
    } finally {
        await app.close()
    }
})

test("timeout never answers and delay postpones the fault", async t => {
    silenceWarnings(t)
    const app = await startApp(ENABLED_ENV)
    try {
        await assert.rejects(
            fetch(`${app.baseUrl}/ok`, { headers: { [FAULT_HEADER]: "timeout" }, signal: AbortSignal.timeout(300) }),
            { name: "TimeoutError" }
        )

        const startedAt = Date.now()
        const delayed = await fetch(`${app.baseUrl}/ok`, {
            headers: { [FAULT_HEADER]: "503", [FAULT_DELAY_HEADER]: "250" },
        })
        assert.equal(delayed.status, 503)
        assert.ok(Date.now() - startedAt >= 240)
    } finally {
        await app.close()
    }
})

test("unknown fault values pass through", async t => {
    silenceWarnings(t)
    const app = await startApp(ENABLED_ENV)
    try {
        const response = await fetch(`${app.baseUrl}/ok`, { headers: { [FAULT_HEADER]: "banana" } })
        assert.equal(response.status, 200)
    } finally {
        await app.close()
    }
})
