/**
 * Client capability configuration (roadmap rules 2–4)
 * @module config/client_capabilities
 */

/**
 * Minimum app version per feature. Read on every call so specs can pass their own environment.
 * Unset → null → the feature is off for every app. All stay unset until the app 1.1.0 release (sub-project D).
 * @param {NodeJS.ProcessEnv} [env] - Environment to read from
 * @returns {{ shortTermRent: string | null }}
 */
export const getFeatureMinAppVersions = (env = process.env) => ({
    shortTermRent: env.MOBILE_MIN_VERSION_SHORT_TERM_RENT || null,
})

/** Agency websites are deployed by us (no version), so they adopt a feature as soon as web and Express support it. */
export const TEMPLATES_FEATURES = Object.freeze({ shortTermRent: true })

const FEATURES = Object.keys(getFeatureMinAppVersions({}))

/** Apps 1.0.5 and older, unknown callers, jobs and admin code that do not pass capabilities. */
export const LEGACY_CAPABILITIES = Object.freeze(Object.fromEntries(FEATURES.map(feature => [feature, false])))

/** Internal callers that must see everything (admin moderation). */
export const ALL_CAPABILITIES = Object.freeze(Object.fromEntries(FEATURES.map(feature => [feature, true])))
