// COPIED FROM imotko/src/utils/api_utils/property.js (only: DEFAULT_PROPERTY_COUNTRY, normalizePropertyCountry, parseLocation, resolvePropertyLocation) by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).
import { PropertyCountry } from "#generated/prisma/enums.ts"
import { getValidPropertyCountry } from "./dictionaries/property.js"

export const DEFAULT_PROPERTY_COUNTRY = PropertyCountry.macedonia

export const normalizePropertyCountry = country => getValidPropertyCountry(country)

export const parseLocation = (location, country = DEFAULT_PROPERTY_COUNTRY) => {
    const validCountry = normalizePropertyCountry(country)

    if (validCountry === PropertyCountry.macedonia && location.includes("-")) {
        const [city, municipality] = location.split("-")
        return { city, municipality }
    }

    return {
        city: location,
        municipality: null,
    }
}

export async function resolvePropertyLocation(tx, locationValue, country = DEFAULT_PROPERTY_COUNTRY) {
    const propertyLocation = parseLocation(locationValue, country)

    const parentLocation = await tx.propertyLocation.upsert({
        where: { name: propertyLocation.city },
        update: {},
        create: {
            name: propertyLocation.city,
            parentId: null,
        },
    })

    if (!propertyLocation.municipality) return parentLocation.id

    const subAreaLocation = await tx.propertyLocation.upsert({
        where: {
            name: propertyLocation.municipality,
            parentId: parentLocation.id,
        },
        update: {},
        create: {
            name: propertyLocation.municipality,
            parentId: parentLocation.id,
        },
    })

    return subAreaLocation.id
}
