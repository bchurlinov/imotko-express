import { PropertyCountry, PropertyListingType, PropertyType } from "#generated/prisma/enums.ts"
import { toPlainText } from "#shared/ai/property_prefill/normalize.js"

const LOCALES = ["mk", "en", "sq", "tr"]
const MIN_TEXT = 80
const MAX_TEXT = 5000
const CONTEXT_ENUMS = {
    type: Object.values(PropertyType),
    listingType: Object.values(PropertyListingType),
    country: Object.values(PropertyCountry),
}

const isPlainObject = value => typeof value === "object" && value !== null && !Array.isArray(value)

// Strict: unknown keys are rejected so no agencyId/userId/propertyId can ever ride along (spec §3.1).
export const parsePrefillBody = body => {
    if (!isPlainObject(body)) return null
    if (!Object.keys(body).every(key => ["text", "locale", "context"].includes(key))) return null

    const text = toPlainText(body.text)
    if (text.length < MIN_TEXT || text.length > MAX_TEXT) return null
    if (!LOCALES.includes(body.locale)) return null

    const rawContext = body.context ?? {}
    if (!isPlainObject(rawContext)) return null
    const context = {}
    for (const [key, value] of Object.entries(rawContext)) {
        if (!(key in CONTEXT_ENUMS)) return null
        if (value === null || value === undefined || value === "") continue
        if (!CONTEXT_ENUMS[key].includes(value)) return null
        context[key] = value
    }

    return { text, locale: body.locale, context }
}
