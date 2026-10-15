// COPIED FROM imotko/src/lib/property/listing_type_rules.js by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).
import { PropertyListingType, PropertyPriceUnit, PropertyType } from "#generated/prisma/enums.ts"
import {
    PropertyListingTypeDictionary,
    PropertyTypeDictionary,
    SHORT_TERM_AMENITY_GROUPS,
    SHORT_TERM_AMENITY_PRIORITY,
    SHORT_TERM_KEY_AMENITIES,
} from "./dictionaries/property.js"

const ALL_PROPERTY_TYPES = Object.values(PropertyType)

export const SHORT_TERM_ONLY_FIELDS = ["maxGuests", "minNights", "checkInFrom", "checkOutUntil"]

export const SHORT_TERM_AMENITIES = [
    "babyCrib",
    "wifi",
    "tv",
    "washingMachine",
    "dishwasher",
    "linensAndTowels",
    "workspace",
    "selfCheckIn",
    "bbq",
    "smokingAllowed",
    "cookingBasics",
    "coffeeMaker",
    "hairDryer",
    "iron",
    "privateEntrance",
    "smokeAlarm",
    "firstAidKit",
    "scenicView",
]

// Used by the search slider when no listing type is selected (matches the previous hardcoded fallback).
const GENERIC_PRICE_RANGE = { min: 100, max: 1_000_000, step: 100, maxPlusLabel: "", maxPlusValue: "" }

export const LISTING_TYPE_RULES = {
    [PropertyListingType.for_sale]: {
        propertyTypes: ALL_PROPERTY_TYPES,
        priceUnits: [PropertyPriceUnit.TOTAL],
        defaultPriceUnit: PropertyPriceUnit.TOTAL,
        hiddenFields: [],
        requiredFields: [],
        priceRange: { min: 10_000, max: 1_000_000, step: 10_000, maxPlusLabel: "2M +", maxPlusValue: "20000000" },
        inPriceStats: true,
    },
    [PropertyListingType.for_rent]: {
        propertyTypes: ALL_PROPERTY_TYPES,
        priceUnits: [PropertyPriceUnit.TOTAL, PropertyPriceUnit.PER_SQUARE_METER],
        defaultPriceUnit: PropertyPriceUnit.TOTAL,
        hiddenFields: ["builder", "yearBuilt", "inDevelopment", "inDevelopmentUntil"],
        requiredFields: [],
        priceRange: { min: 100, max: 5_000, step: 50, maxPlusLabel: "5,000+", maxPlusValue: "50000" },
        inPriceStats: true,
    },
    [PropertyListingType.short_term_rent]: {
        propertyTypes: [PropertyType.flat, PropertyType.house, PropertyType.holiday_home],
        priceUnits: [PropertyPriceUnit.PER_NIGHT],
        defaultPriceUnit: PropertyPriceUnit.PER_NIGHT,
        hiddenFields: [
            "builder",
            "yearBuilt",
            "inDevelopment",
            "inDevelopmentUntil",
            "hasApproximatePrice",
            "approximatePrice",
            "estimationPrice",
        ],
        requiredFields: ["maxGuests", "minNights"],
        priceRange: { min: 10, max: 300, step: 5, maxPlusLabel: "300+", maxPlusValue: "3000" },
        inPriceStats: false,
    },
}

export const isShortTermRent = listingType => listingType === PropertyListingType.short_term_rent
export const isRentalListingType = listingType =>
    listingType === PropertyListingType.for_rent || isShortTermRent(listingType)

export const getListingTypeRules = listingType => LISTING_TYPE_RULES[listingType]

export const isPropertyTypeAllowed = (listingType, type) => {
    const rules = getListingTypeRules(listingType)
    if (!rules || !type) return true
    return rules.propertyTypes.includes(type)
}

export const isPriceUnitAllowed = (listingType, unit) => {
    const rules = getListingTypeRules(listingType)
    if (!rules || !unit) return true
    return rules.priceUnits.includes(unit)
}

export const getDefaultPriceUnit = listingType =>
    getListingTypeRules(listingType)?.defaultPriceUnit ?? PropertyPriceUnit.TOTAL

export const getPriceRange = listingType => getListingTypeRules(listingType)?.priceRange ?? GENERIC_PRICE_RANGE

export const isListingTypeInPriceStats = listingType => getListingTypeRules(listingType)?.inPriceStats !== false

export const getEnabledListingTypes = ({ includeShortTerm = true } = {}) =>
    Object.values(PropertyListingType).filter(listingType => includeShortTerm || !isShortTermRent(listingType))

export const getListingTypeOptions = (locale, { includeShortTerm = true } = {}) =>
    (PropertyListingTypeDictionary[locale] ?? PropertyListingTypeDictionary.en).filter(
        option => includeShortTerm || !isShortTermRent(option.value)
    )

// `type` is optional: search filters show amenities before a property type is chosen.
// Short-term amenity groups limited to `names` (for example the amenities visible for the property type, or the ones a
// listing has). Keeps the group order and drops empty groups.
export const groupShortTermAmenities = (names = []) =>
    SHORT_TERM_AMENITY_GROUPS.map(group => ({
        key: group.key,
        items: group.items.filter(name => names.includes(name)),
    })).filter(group => group.items.length > 0)

// Key amenities (wifi, air conditioning, heating, smoke alarm) a listing does not have, from its attributes.
export const getMissingKeyAmenities = (attributes = {}) =>
    SHORT_TERM_KEY_AMENITIES.filter(({ name, anyOf = [name] }) => !anyOf.some(key => attributes?.[key] === true)).map(
        ({ name }) => name
    )

// The `limit` most important amenities across `groups` (output of groupShortTermAmenities), in priority order.
export const pickTopAmenities = (groups = [], limit = 6) => {
    const rank = name => {
        const index = SHORT_TERM_AMENITY_PRIORITY.indexOf(name)
        return index === -1 ? SHORT_TERM_AMENITY_PRIORITY.length : index
    }
    return groups
        .flatMap(group => group.items)
        .sort((a, b) => rank(a) - rank(b))
        .slice(0, limit)
}

export const isAmenityVisible = (feature, { type, listingType } = {}) => {
    const listingTypeMatches = !feature.listingTypes || feature.listingTypes.includes(listingType)
    const typeMatches = !type || feature.visible.includes(type)
    return listingTypeMatches && typeMatches
}

const toPositiveIntOrNull = value => {
    const numeric = Number(value)
    return Number.isInteger(numeric) && numeric > 0 ? numeric : null
}

// Server-side source of truth for listing-type dependent columns; spread after the rest of the DTO.
export const normalizeListingTypeFields = (body = {}) => {
    const { listingType } = body
    const priceUnit =
        body.priceUnit && isPriceUnitAllowed(listingType, body.priceUnit)
            ? body.priceUnit
            : getDefaultPriceUnit(listingType)
    if (!isShortTermRent(listingType)) {
        return { priceUnit, maxGuests: null, minNights: null, checkInFrom: null, checkOutUntil: null }
    }

    return {
        priceUnit,
        maxGuests: toPositiveIntOrNull(body.maxGuests),
        minNights: toPositiveIntOrNull(body.minNights),
        checkInFrom: body.checkInFrom || null,
        checkOutUntil: body.checkOutUntil || null,
        inDevelopment: false,
        inDevelopmentUntil: null,
        hasApproximatePrice: false,
        approximatePrice: null,
        estimationPrice: null,
        // Hommex never receives short-term listings (design §6); isHommexEligible also refuses them (Task 14).
        publishToHommex: false,
    }
}

export const pickShortTermAmenities = (body = {}) => {
    if (!isShortTermRent(body.listingType)) return {}
    return Object.fromEntries(SHORT_TERM_AMENITIES.filter(name => body[name] === true).map(name => [name, true]))
}

// Search filters after the visitor picks a listing type (or clears it with `undefined`). Shared by the filter bar and
// the filters dialog so both drop the same incompatible filters. Returns a new object.
export const applyListingTypeToFilters = (filters = {}, nextListingType, locale) => {
    const next = { ...filters }
    delete next.price_from
    delete next.price_to

    if (nextListingType) next.listingType = nextListingType
    else delete next.listingType

    const categoryType = PropertyTypeDictionary[locale]?.find(entry => entry.id === next.category)?.value
    if (!isPropertyTypeAllowed(nextListingType, categoryType)) {
        delete next.category
        delete next.subCategory
    }

    if (isShortTermRent(nextListingType)) {
        delete next.in_development
    } else {
        delete next.guests
        SHORT_TERM_AMENITIES.forEach(name => delete next[name])
    }

    return next
}
