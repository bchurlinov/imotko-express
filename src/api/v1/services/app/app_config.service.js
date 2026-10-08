import { LEGACY_CAPABILITIES } from "#config/client_capabilities.js"
import { parseAppVersion } from "#middlewares/client_capabilities.js"

export const APP_STORE_URLS = Object.freeze({
    ios: "https://apps.apple.com/app/id6760807862",
    android: "https://play.google.com/store/apps/details?id=com.bojan.churlinov.imotkomobile",
})
export const DEFAULT_LATEST_VERSION = "1.0.5"
export const DEFAULT_MIN_SUPPORTED_VERSION = "1.0.0"

const versionOr = (value, fallback) => (parseAppVersion(value) ? value.trim() : fallback)

export const getAppConfig = (capabilities = LEGACY_CAPABILITIES, env = process.env) => ({
    features: {
        shortTermRent: Boolean(capabilities.shortTermRent),
        clientListings: Boolean(capabilities.clientListings),
    },
    latestVersion: versionOr(env.MOBILE_LATEST_VERSION, DEFAULT_LATEST_VERSION),
    minSupportedVersion: versionOr(env.MOBILE_MIN_SUPPORTED_VERSION, DEFAULT_MIN_SUPPORTED_VERSION),
    storeUrls: APP_STORE_URLS,
})
