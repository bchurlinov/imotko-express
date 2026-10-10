// COPIED FROM imotko/src/lib/ai/property_prefill/field_sets.js by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).
import { PropertyType } from "#generated/prisma/enums.ts"
import { PropertyFeaturesDictionary, PropertyTypeDictionary } from "../../property_rules/dictionaries/property.js"
import {
    getListingTypeRules,
    isAmenityVisible,
    isRentalListingType,
    isShortTermRent,
} from "../../property_rules/listing_type_rules.js"

// Imported by the browser (apply step) as well as by Express: keep this file free of server-only imports.
export const PREFILL_ACTOR = { AGENCY: "agency", ADMIN: "admin", CLIENT: "client" }

export const NUMBER_KEYS = [
    "size",
    "sizeOfYard",
    "numOfRooms",
    "numOfBathrooms",
    "numOfBalconies",
    "flatFloor",
    "flatFloorFrom",
    "price",
    "maxGuests",
    "minNights",
]
export const YEAR_KEYS = ["yearBuilt", "inDevelopmentUntil"]
export const STRING_KEYS = [
    "address",
    "externalId",
    "video",
    "builder",
    "propertyDeed",
    "propertyCadastralMunicipality",
    "checkInFrom",
    "checkOutUntil",
]
export const FLAG_KEYS = ["hasApproximatePrice", "inDevelopment"]
export const ENUM_KEYS = ["orientation", "priceUnit"]
export const AMENITY_KEYS = PropertyFeaturesDictionary.map(feature => feature.name)

export const CLIENT_EXCLUDED_KEYS = ["externalId", "name"]

// Dependent fields after the fields they depend on (spec decision 18).
export const PREFILL_APPLY_ORDER = ["listingType", "type", "propertySubType", "country", "city", "district"]

const ROOM_TYPES = [PropertyType.flat, PropertyType.house, PropertyType.holiday_home, PropertyType.commercial]
const CONSTRUCTION_KEYS = ["builder", "yearBuilt", "inDevelopment", "inDevelopmentUntil"]
const STAY_KEYS = ["maxGuests", "minNights", "checkInFrom", "checkOutUntil"]

export const getSubtypeValues = type => {
    const types = PropertyTypeDictionary.en.filter(entry => !type || entry.value === type)
    return [...new Set(types.flatMap(entry => (entry.subcategories || []).map(subtype => subtype.value)))]
}

// Mirrors what property.jsx shows for the resolved type/listing type (spec decision 17).
const isConstructionVisible = (type, listingType) =>
    Boolean(type) && type !== PropertyType.land && !isRentalListingType(listingType)

export const isPrefillKeyEligible = (key, { type, listingType, actorKind } = {}) => {
    if (actorKind === PREFILL_ACTOR.CLIENT && CLIENT_EXCLUDED_KEYS.includes(key)) return false
    if ((getListingTypeRules(listingType)?.hiddenFields || []).includes(key)) return false

    if (AMENITY_KEYS.includes(key)) {
        const feature = PropertyFeaturesDictionary.find(entry => entry.name === key)
        return Boolean(type) && type !== PropertyType.land && isAmenityVisible(feature, { type, listingType })
    }
    if (CONSTRUCTION_KEYS.includes(key)) return isConstructionVisible(type, listingType)
    if (STAY_KEYS.includes(key)) return isShortTermRent(listingType)

    switch (key) {
        case "propertySubType":
            return Boolean(type)
        case "sizeOfYard":
            return type === PropertyType.house
        case "numOfRooms":
        case "numOfBathrooms":
        case "numOfBalconies":
            return ROOM_TYPES.includes(type)
        case "flatFloor":
        case "flatFloorFrom":
            return type === PropertyType.flat && isConstructionVisible(type, listingType)
        case "orientation":
            return Boolean(type) && type !== PropertyType.land && type !== PropertyType.garage
        case "priceUnit":
            return Boolean(listingType)
        default:
            return true
    }
}
