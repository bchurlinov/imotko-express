import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"
import express from "express"
import createError from "http-errors"
import { errorMiddleware } from "./errorMiddleware.js"

const startApp = async () => {
    const app = express()
    app.use(express.json())
    // Fails after an async hop, like a route behind the rate limiter: by then Node has destroyed the read request.
    app.post("/fail", async (req, res, next) => {
        await new Promise(resolve => setImmediate(resolve))
        next(createError(400, "Invalid body", { errors: [{ path: "price" }] }))
    })
    app.use(errorMiddleware)
    const server = await new Promise(resolve => {
        const listening = app.listen(0, "127.0.0.1", () => resolve(listening))
    })
    const baseUrl = `http://127.0.0.1:${server.address().port}`
    return { baseUrl, close: () => new Promise(resolve => server.close(resolve)) }
}

// Keeps errLog.txt and the console clean.
const silenceLogging = t => {
    t.mock.method(fs.promises, "appendFile", async () => {})
    t.mock.method(console, "error", () => {})
}

test("answers errors on requests whose JSON body was already read", async t => {
    silenceLogging(t)
    const app = await startApp()
    try {
        const response = await fetch(`${app.baseUrl}/fail`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ price: null }),
            signal: AbortSignal.timeout(3000),
        })
        assert.equal(response.status, 400)
        assert.deepEqual(await response.json(), {
            status: 400,
            message: "Invalid body",
            errors: [{ path: "price" }],
        })
    } finally {
        await app.close()
    }
})
