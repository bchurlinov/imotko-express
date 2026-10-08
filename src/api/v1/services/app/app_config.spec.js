import assert from "node:assert/strict"
import test from "node:test"
import { LEGACY_CAPABILITIES } from "#config/client_capabilities.js"
import { getAppConfig } from "./app_config.service.js"

test("legacy callers see every feature off and the default versions", () => {
    assert.deepEqual(getAppConfig(LEGACY_CAPABILITIES, {}), {
        features: { shortTermRent: false, clientListings: false },
        latestVersion: "1.0.5",
        minSupportedVersion: "1.0.0",
        storeUrls: {
            ios: "https://apps.apple.com/app/id6760807862",
            android: "https://play.google.com/store/apps/details?id=com.bojan.churlinov.imotkomobile",
        },
    })
})

test("features mirror caller capabilities; versions come from environment", () => {
    const config = getAppConfig(
        { shortTermRent: true, clientListings: true },
        { MOBILE_LATEST_VERSION: " 1.1.0 ", MOBILE_MIN_SUPPORTED_VERSION: "1.0.0" }
    )
    assert.deepEqual(config.features, { shortTermRent: true, clientListings: true })
    assert.equal(config.latestVersion, "1.1.0")
    assert.equal(config.minSupportedVersion, "1.0.0")
})

test("an unparsable version falls back to default", () => {
    const config = getAppConfig(LEGACY_CAPABILITIES, { MOBILE_LATEST_VERSION: "next", MOBILE_MIN_SUPPORTED_VERSION: "x" })
    assert.equal(config.latestVersion, "1.0.5")
    assert.equal(config.minSupportedVersion, "1.0.0")
})
