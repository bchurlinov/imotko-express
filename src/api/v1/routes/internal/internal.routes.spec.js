import assert from "node:assert/strict"
import test from "node:test"
import { isValidRevalidateSecret } from "./internal.routes.js"

test("accepts the matching secret", () => {
    assert.equal(isValidRevalidateSecret("s3cret", "s3cret"), true)
})

test("rejects a different secret", () => {
    assert.equal(isValidRevalidateSecret("nope00", "s3cret"), false)
})

test("rejects when either side is missing", () => {
    assert.equal(isValidRevalidateSecret(undefined, "s3cret"), false)
    assert.equal(isValidRevalidateSecret("s3cret", undefined), false)
    assert.equal(isValidRevalidateSecret("", ""), false)
})
