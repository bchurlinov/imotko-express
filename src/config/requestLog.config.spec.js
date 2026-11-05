import assert from "node:assert/strict"
import { test } from "node:test"
import express from "express"
import { createRequestLogger } from "./requestLog.config.js"

const logRequest = async ({ headers = {}, trusted = false } = {}) => {
    const lines = []
    const app = express()
    app.set("trust proxy", 1)
    app.use(createRequestLogger({ stream: { write: line => lines.push(line) } }))
    app.use((req, res, next) => {
        req.trustedInternalCaller = trusted
        next()
    })
    app.get("/ping", (req, res) => res.json({ ok: true }))

    const server = await new Promise(resolve => {
        const listening = app.listen(0, "127.0.0.1", () => resolve(listening))
    })

    try {
        await fetch(`http://127.0.0.1:${server.address().port}/ping`, { headers })
        // Morgan writes on response finish, which can land just after fetch resolves
        for (let attempt = 0; attempt < 50 && lines.length === 0; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 10))
        }
    } finally {
        await new Promise(resolve => server.close(resolve))
    }

    return lines[0]
}

test("logs the real client IP, client header, referrer and user agent", async () => {
    const line = await logRequest({
        headers: {
            "X-Forwarded-For": "203.0.113.7",
            "X-Imotko-Client": "mobile",
            Referer: "https://agency.example/listing",
            "User-Agent": "test-agent/1.0",
        },
    })

    assert.match(line, /^GET \/ping 200 /)
    assert.match(line, /ip=203\.0\.113\.7 /)
    assert.match(line, /client=mobile /)
    assert.match(line, /internal=no /)
    assert.match(line, /referrer="https:\/\/agency\.example\/listing" /)
    assert.match(line, /ua="test-agent\/1\.0"/)
})

test("marks verified internal callers and shows a dash for missing headers", async () => {
    const line = await logRequest({ trusted: true })

    assert.match(line, /client=- /)
    assert.match(line, /internal=yes /)
    assert.match(line, /referrer="-" /)
})
