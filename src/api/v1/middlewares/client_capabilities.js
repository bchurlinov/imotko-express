import {
    getFeatureMinAppVersions,
    LEGACY_CAPABILITIES,
    TEMPLATES_FEATURES,
    WEB_FEATURES,
} from "#config/client_capabilities.js"

const VERSION_PATTERN = /^\d+(\.\d+){0,2}$/

/**
 * "1.10" → [1, 10, 0]; anything that is not 1–3 dot-separated numbers → null
 * @param {unknown} value - Raw header value
 * @returns {number[] | null}
 */
export const parseAppVersion = value => {
    const version = typeof value === "string" ? value.trim() : ""
    if (!VERSION_PATTERN.test(version)) return null
    const parts = version.split(".").map(Number)
    while (parts.length < 3) parts.push(0)
    return parts
}

/**
 * Numeric comparison per segment, so 1.0.10 > 1.0.9
 * @param {unknown} version - App version
 * @param {unknown} minimum - Required minimum
 * @returns {boolean}
 */
export const isVersionAtLeast = (version, minimum) => {
    const current = parseAppVersion(version)
    const required = parseAppVersion(minimum)
    if (!current || !required) return false
    for (let index = 0; index < 3; index += 1) {
        if (current[index] !== required[index]) return current[index] > required[index]
    }
    return true
}

/**
 * Works out what a caller may see. No header, an unknown client, or an unparsable version → legacy.
 * @param {{ client?: string, appVersion?: string }} caller - Header values
 * @param {NodeJS.ProcessEnv} [env] - Environment to read the minimum versions from
 * @returns {{ shortTermRent: boolean, clientListings: boolean }}
 */
export const resolveClientCapabilities = ({ client, appVersion } = {}, env = process.env) => {
    const caller = typeof client === "string" ? client.trim().toLowerCase() : ""
    const features = Object.keys(LEGACY_CAPABILITIES)

    if (caller === "templates") {
        return Object.fromEntries(features.map(feature => [feature, TEMPLATES_FEATURES[feature] === true]))
    }

    if (caller === "web") {
        return Object.fromEntries(features.map(feature => [feature, WEB_FEATURES[feature] === true]))
    }

    if (caller === "mobile") {
        const minVersions = getFeatureMinAppVersions(env)
        return Object.fromEntries(
            features.map(feature => [
                feature,
                Boolean(minVersions[feature]) && isVersionAtLeast(appVersion, minVersions[feature]),
            ])
        )
    }

    return { ...LEGACY_CAPABILITIES }
}

/**
 * Sets req.capabilities for every /api/v1 request
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 */
export const attachClientCapabilities = (req, res, next) => {
    req.capabilities = resolveClientCapabilities({
        client: req.get("X-Imotko-Client"),
        appVersion: req.get("X-Imotko-App-Version"),
    })
    next()
}
