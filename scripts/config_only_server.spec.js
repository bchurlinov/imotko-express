import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import net from "node:net"
import { after, before, test } from "node:test"
import { createConfigOnlyApp } from "./config_only_server.js"

let server
let baseUrl

before(async () => {
    process.env.MOBILE_MIN_SUPPORTED_VERSION = "1.1.1"
    process.env.MOBILE_LATEST_VERSION = "1.1.1"
    server = createConfigOnlyApp().listen(0)
    await new Promise(resolve => server.once("listening", resolve))
    baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(() => server.close())

const get = (path, headers = {}) => fetch(`${baseUrl}${path}`, { headers })

const getFreePort = () =>
    new Promise((resolve, reject) => {
        const probe = net.createServer()
        probe.once("error", reject)
        probe.listen(0, () => {
            const { port } = probe.address()
            probe.close(() => resolve(port))
        })
    })

const waitForHealth = async port => {
    const deadline = Date.now() + 5000
    while (Date.now() < deadline) {
        try {
            return await fetch(`http://127.0.0.1:${port}/health`)
        } catch {
            await new Promise(resolve => setTimeout(resolve, 100))
        }
    }
    throw new Error("stub never answered /health")
}

// Review Focus 4
test("a 1.1.0 app is told to update, with today's JSON shape", async () => {
    const res = await get("/api/v1/app/config", { "X-Imotko-Client": "mobile", "X-Imotko-App-Version": "1.1.0" })
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.data.minSupportedVersion, "1.1.1")
    assert.deepEqual(Object.keys(body.data).sort(), ["features", "latestVersion", "minSupportedVersion", "storeUrls"])
    assert.equal(body.code, 200)
})

test("health answers 200", async () => {
    assert.equal((await get("/health")).status, 200)
})

// Review Focus 5
test("every other route gets a JSON 410", async () => {
    for (const path of ["/api/v1/properties", "/api/v1/auth/login", "/"]) {
        const res = await get(path)
        assert.equal(res.status, 410, path)
        assert.equal((await res.json()).code, 410)
    }
})

test("the stub starts without any database or Redis env", async () => {
    const port = await getFreePort()
    const child = spawn(process.execPath, ["--experimental-transform-types", "scripts/config_only_server.js"], {
        env: { PATH: process.env.PATH, PORT: String(port), MOBILE_MIN_SUPPORTED_VERSION: "1.1.1" },
    })
    try {
        assert.equal((await waitForHealth(port)).status, 200)
    } finally {
        child.kill()
    }
})

// Final review M3: a missing variable on Railway must still block 1.1.0, not leave it on a dead backend
test("without MOBILE_MIN_SUPPORTED_VERSION the stub still blocks 1.1.0", async () => {
    const port = await getFreePort()
    const child = spawn(process.execPath, ["--experimental-transform-types", "scripts/config_only_server.js"], {
        env: { PATH: process.env.PATH, PORT: String(port) },
    })
    try {
        await waitForHealth(port)
        const res = await fetch(`http://127.0.0.1:${port}/api/v1/app/config`, {
            headers: { "X-Imotko-Client": "mobile", "X-Imotko-App-Version": "1.1.0" },
        })
        assert.equal((await res.json()).data.minSupportedVersion, "1.1.1")
    } finally {
        child.kill()
    }
})
