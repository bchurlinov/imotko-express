// COPIED FROM imotko/src/lib/ai/property_prefill/title.js by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).
import { PropertyListingType, PropertyType } from "#generated/prisma/enums.ts"
import {
    getPropertyDistrictsByCountryLocation,
    getPropertyLocationsByCountry,
    PropertyTypeDictionary,
} from "../../property_rules/dictionaries/property.js"

const LISTING_WORDS = {
    mk: {
        [PropertyListingType.for_sale]: "Се продава",
        [PropertyListingType.for_rent]: "Се издава",
        [PropertyListingType.short_term_rent]: "Се издава за ноќевање",
    },
    en: {
        [PropertyListingType.for_sale]: "for sale",
        [PropertyListingType.for_rent]: "for rent",
        [PropertyListingType.short_term_rent]: "for short-term rent",
    },
    sq: {
        [PropertyListingType.for_sale]: "në shitje",
        [PropertyListingType.for_rent]: "me qira",
        [PropertyListingType.short_term_rent]: "me qira ditore",
    },
    tr: {
        [PropertyListingType.for_sale]: "Satılık",
        [PropertyListingType.for_rent]: "Kiralık",
        [PropertyListingType.short_term_rent]: "Günlük kiralık",
    },
}

const typeLabel = (type, locale) =>
    (PropertyTypeDictionary[locale] || PropertyTypeDictionary.en)
        .find(entry => entry.value === type)
        ?.label?.toLowerCase()

const lastSegment = label => (label ? String(label).split(" - ").pop() : undefined)

const placeLabel = ({ city, district, country, locale }) => {
    if (city && district) {
        const option = getPropertyDistrictsByCountryLocation(country, city, locale).find(
            entry => entry.value === district
        )
        if (option) return option.label
    }
    if (!city) return undefined
    return lastSegment(getPropertyLocationsByCountry(country, locale).find(entry => entry.value === city)?.label)
}

const capitalize = text => text.charAt(0).toUpperCase() + text.slice(1)

// Built only from verified fields: a fragment whose source field was not verified is left out (spec §5.5).
export const buildPrefillTitle = ({ listingType, type, numOfRooms, city, district, country, locale = "mk" } = {}) => {
    const words = LISTING_WORDS[locale] || LISTING_WORDS.mk
    const label = typeLabel(type, locale)
    if (!listingType || !words[listingType] || !label) return null

    const rooms = type === PropertyType.flat && Number.isInteger(numOfRooms) && numOfRooms > 0 ? numOfRooms : null
    const place = placeLabel({ city, district, country, locale })

    if (locale === "en") {
        return capitalize(
            `${rooms ? `${rooms}-room ` : ""}${label} ${words[listingType]}${place ? ` in ${place}` : ""}`
        )
    }
    if (locale === "sq") {
        return capitalize(
            `${label}${rooms ? ` me ${rooms} dhoma` : ""} ${words[listingType]}${place ? ` në ${place}` : ""}`
        )
    }
    if (locale === "tr") {
        return `${words[listingType]}${rooms ? ` ${rooms} odalı` : ""} ${label}${place ? ` – ${place}` : ""}`
    }
    return `${words[listingType]}${rooms ? ` ${rooms}-собен` : ""} ${label}${place ? ` во ${place}` : ""}`
}
