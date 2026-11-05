import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { test } from "node:test"
import { pathToFileURL } from "node:url"

test("the job can load the factory without Supabase env vars", () => {
    const factoryUrl = pathToFileURL(new URL("./supabaseAdminFactory.js", import.meta.url).pathname).href
    const script = `
        const { createSupabaseAdminClient } = await import(${JSON.stringify(factoryUrl)})
        const client = createSupabaseAdminClient({ url: "https://example.supabase.co", key: "service-role-key" })
        if (typeof client.storage?.from !== "function") process.exit(2)
    `
    // An env with no SUPABASE_* values: the factory must not read config or process.env.
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
        env: { PATH: process.env.PATH },
        encoding: "utf8",
    })

    assert.equal(result.status, 0, result.stderr)
})
