import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { test } from "node:test"

test("invalid configuration exits before opening Redis or Prisma connections", () => {
    const result = spawnSync(
        process.execPath,
        ["--experimental-transform-types", "workers/facebook-property-publication/index.js"],
        {
            cwd: process.cwd(),
            encoding: "utf8",
            timeout: 3000,
            env: {
                ...process.env,
                DATABASE_URL: "postgresql://user:password@127.0.0.1:1/imotko",
                UPSTASH_REDIS_URL: "rediss://default:redis-secret@127.0.0.1:1",
                META_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
                META_GRAPH_API_VERSION: "",
                PUBLIC_APP_URL: "https://imotko.mk",
            },
        }
    )

    const output = `${result.stdout}${result.stderr}`
    assert.equal(result.signal, null)
    assert.equal(result.status, 1)
    assert.match(output, /META_GRAPH_API_VERSION/)
    assert.doesNotMatch(output, /redis-secret|password/)
})
