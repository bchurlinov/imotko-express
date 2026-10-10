// COPIED FROM imotko/src/lib/ai/property_prefill/location_match.js by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).
import {
    getPropertyLocationsByCountry,
    getValidPropertyCountry,
    PropertyDistrictDictionaryByCountry,
} from "../../property_rules/dictionaries/property.js"
import { normalizeText } from "./normalize.js"

const LOCALES = ["mk", "en", "sq", "tr"]
const GENERIC_PREFIXES = new Set([
    "opshtina",
    "opstina",
    "naselba",
    "naselbata",
    "s",
    "selo",
    "grad",
    "komuna",
    "municipality",
    "qyteti",
    "fshati",
])

const stripGenericPrefixes = normalized => {
    const tokens = normalized.split(" ").filter(Boolean)
    while (tokens.length > 1 && GENERIC_PREFIXES.has(tokens[0])) tokens.shift()
    return tokens.join(" ")
}

const toKey = mention => (typeof mention === "string" ? stripGenericPrefixes(normalizeText(mention)) : "")

// "Skopje - Aerodrom" also answers to "Aerodrom".
const labelVariants = label => {
    const full = normalizeText(label)
    const parts = String(label).split(" - ")
    return parts.length > 1 ? [full, normalizeText(parts[parts.length - 1])] : [full]
}

const unique = values => {
    const set = new Set(values)
    return set.size === 1 ? [...set][0] : undefined
}

const matchCity = (key, country) => {
    if (!key) return undefined
    const hits = LOCALES.flatMap(locale =>
        getPropertyLocationsByCountry(country, locale)
            .filter(option => labelVariants(option.label).includes(key))
            .map(option => option.value)
    )
    return unique(hits)
}

// Every { city, district } pair whose district label matches, across all locales of the district dictionary.
const districtHits = (key, country, cityFilter = () => true) => {
    if (!key) return []
    const byLocale = PropertyDistrictDictionaryByCountry[country] || {}
    const hits = new Map()
    for (const dictionary of Object.values(byLocale)) {
        for (const [city, options] of Object.entries(dictionary || {})) {
            if (!cityFilter(city)) continue
            for (const option of options) {
                if (normalizeText(option.label) === key)
                    hits.set(`${city}|${option.value}`, { city, district: option.value })
            }
        }
    }
    return [...hits.values()]
}

const single = hits => (hits.length === 1 ? hits[0] : undefined)

// "Бејбунар-Билјанини Извори": a compound mention that is no district label itself but contains whole district
// labels. The longest label wins (most specific); equally long labels from different districts stay ambiguous.
const containedDistrict = (key, country, cityFilter = () => true) => {
    if (!key) return undefined
    const padded = ` ${key} `
    const byLocale = PropertyDistrictDictionaryByCountry[country] || {}
    const hits = new Map()
    for (const dictionary of Object.values(byLocale)) {
        for (const [city, options] of Object.entries(dictionary || {})) {
            if (!cityFilter(city)) continue
            for (const option of options) {
                const label = normalizeText(option.label)
                if (label.length >= 3 && padded.includes(` ${label} `)) {
                    hits.set(`${city}|${option.value}`, { city, district: option.value, length: label.length })
                }
            }
        }
    }
    const longest = Math.max(0, ...[...hits.values()].map(hit => hit.length))
    const best = single([...hits.values()].filter(hit => hit.length === longest))
    return best ? { city: best.city, district: best.district } : undefined
}

// "Скопје - Центар" with no district written: the municipality's own same-named district ("Центар") is the default.
// Municipalities without such a district (Карпош has Карпош 1..4) stay city-only.
const defaultDistrictForCity = (city, country) => {
    const byLocale = PropertyDistrictDictionaryByCountry[country] || {}
    const values = LOCALES.flatMap(locale => {
        const label = getPropertyLocationsByCountry(country, locale).find(option => option.value === city)?.label
        const options = byLocale[locale]?.[city] || []
        if (!label || options.length === 0) return []
        const own = labelVariants(label).at(-1)
        return options.filter(option => normalizeText(option.label) === own).map(option => option.value)
    })
    return unique(values)
}

export const matchPrefillLocation = ({ cityMention, districtMention, country } = {}) => {
    const validCountry = getValidPropertyCountry(country)
    const cityKey = toKey(cityMention)
    const districtKey = toKey(districtMention)
    const city = matchCity(cityKey, validCountry)

    if (city) {
        if (!districtKey) {
            const district = defaultDistrictForCity(city, validCountry)
            return district ? { city, district } : { city }
        }
        const inCity = single(districtHits(districtKey, validCountry, key => key === city))
        if (inCity) return inCity
        // "Скопје" + "Водно": the district lives under a Skopje sub-municipality.
        const inChildren = single(districtHits(districtKey, validCountry, key => key.startsWith(`${city}-`)))
        if (inChildren) return inChildren
        const inside = containedDistrict(districtKey, validCountry, key => key === city || key.startsWith(`${city}-`))
        return inside || { city }
    }

    // No city match: a unique district (or a district written in the city slot) decides both.
    return (
        single(districtHits(districtKey, validCountry)) ||
        single(districtHits(cityKey, validCountry)) ||
        containedDistrict(districtKey, validCountry) ||
        containedDistrict(cityKey, validCountry) ||
        {}
    )
}
