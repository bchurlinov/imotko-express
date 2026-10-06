import assert from "node:assert/strict"
import test from "node:test"
import { LEGACY_CAPABILITIES } from "#config/client_capabilities.js"
import {
    attachClientCapabilities,
    isVersionAtLeast,
    parseAppVersion,
    resolveClientCapabilities,
} from "./client_capabilities.js"

const ENV_UNSET = {}
const ENV_1_1_0 = { MOBILE_MIN_VERSION_SHORT_TERM_RENT: "1.1.0" }

test("callers without a header are legacy for every feature", () => {
    assert.deepEqual(resolveClientCapabilities({}, ENV_1_1_0), { shortTermRent: false })
    assert.deepEqual(LEGACY_CAPABILITIES, { shortTermRent: false })
})

test("agency websites get the templates features", () => {
    assert.deepEqual(resolveClientCapabilities({ client: "templates" }, ENV_UNSET), { shortTermRent: true })
    assert.deepEqual(resolveClientCapabilities({ client: " Templates " }, ENV_UNSET), { shortTermRent: true })
})

test("the app gets nothing while the minimum version is unset", () => {
    assert.deepEqual(resolveClientCapabilities({ client: "mobile", appVersion: "9.9.9" }, ENV_UNSET), {
        shortTermRent: false,
    })
})

test("the app gets a feature from its minimum version on", () => {
    const resolve = appVersion => resolveClientCapabilities({ client: "mobile", appVersion }, ENV_1_1_0).shortTermRent
    assert.equal(resolve("1.0.5"), false)
    assert.equal(resolve("1.1.0"), true)
    assert.equal(resolve("1.10.0"), true)
    assert.equal(resolve("2"), true)
    assert.equal(resolve(undefined), false)
    assert.equal(resolve("1.1.0-beta"), false)
    assert.equal(resolve("garbage"), false)
})

test("unknown clients are legacy", () => {
    assert.deepEqual(resolveClientCapabilities({ client: "curl", appVersion: "5.0.0" }, ENV_1_1_0), {
        shortTermRent: false,
    })
})

test("versions compare numerically per segment", () => {
    assert.deepEqual(parseAppVersion("1.2"), [1, 2, 0])
    assert.equal(parseAppVersion("1.2.3.4"), null)
    assert.equal(isVersionAtLeast("1.0.10", "1.0.9"), true)
    assert.equal(isVersionAtLeast("1.0.9", "1.0.10"), false)
    assert.equal(isVersionAtLeast("1.1.0", "1.1.0"), true)
    assert.equal(isVersionAtLeast("1.1.0", null), false)
})

test("the middleware reads both headers", () => {
    const headers = { "x-imotko-client": "templates" }
    const req = { get: name => headers[name.toLowerCase()] }
    let nextCalled = false
    attachClientCapabilities(req, {}, () => {
        nextCalled = true
    })
    assert.equal(nextCalled, true)
    assert.deepEqual(req.capabilities, { shortTermRent: true })
})
