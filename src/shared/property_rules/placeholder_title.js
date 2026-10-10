// COPIED FROM imotko/src/lib/client_listings/placeholder_title.js by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).
import { PropertyListingType } from "#generated/prisma/enums.ts"
import {
    getPropertyDistrictsByCountryLocation,
    getPropertyLocationsByCountry,
    PropertyTypeDictionary,
} from "./dictionaries/property.js"

// Client listings have no title field: until the AI step writes one (private listing AI cleanup §3.4), and for good if
// it fails, the listing carries this title built only from structured fields. Macedonian, like name.mk.
const PREFIX = {
    [PropertyListingType.for_sale]: "Се продава",
    [PropertyListingType.for_rent]: "Се издава",
}

const lowerFirst = text => (text ? text.charAt(0).toLocaleLowerCase("mk") + text.slice(1) : text)
const upperFirst = text => (text ? text.charAt(0).toLocaleUpperCase("mk") + text.slice(1) : text)

const labelOf = (options, value) => (value ? options.find(option => option.value === value)?.label : undefined)

export const buildPlaceholderTitle = ({ listingType, type, propertySubType, country, city, district } = {}) => {
    const category = PropertyTypeDictionary.mk.find(entry => entry.value === type)
    const kind = labelOf(category?.subcategories || [], propertySubType) || category?.label || "имот"
    const cityLabel = labelOf(getPropertyLocationsByCountry(country, "mk"), city)
    const districtLabel = city
        ? labelOf(getPropertyDistrictsByCountryLocation(country, city, "mk"), district)
        : undefined
    const place = [districtLabel, cityLabel].filter(Boolean).join(", ")

    return upperFirst([PREFIX[listingType], lowerFirst(kind), place && `во ${place}`].filter(Boolean).join(" "))
}

export const withPlaceholderTitle = (body = {}) => ({ ...body, name: buildPlaceholderTitle(body) })
