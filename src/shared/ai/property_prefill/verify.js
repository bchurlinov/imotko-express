// COPIED FROM imotko/src/lib/ai/property_prefill/verify.js by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).
import { PropertyCountry, PropertyOrientation, PropertyType } from "#generated/prisma/enums.ts"
import {
    getEnabledListingTypes,
    isPriceUnitAllowed,
    isPropertyTypeAllowed,
} from "../../property_rules/listing_type_rules.js"
import { stripContactDetails } from "../../property_rules/contact_details.js"
import { isEvidenceInText, isNumberGrounded, isValueInEvidence, normalizeText } from "./normalize.js"
import { AMENITY_KEYS, getSubtypeValues, isPrefillKeyEligible, NUMBER_KEYS, PREFILL_ACTOR } from "./field_sets.js"
import { matchPrefillLocation } from "./location_match.js"
import { buildPrefillTitle } from "./title.js"
import { toPrefillDescription } from "./description.js"

const CURRENT_YEAR = new Date().getFullYear()

const NUMBER_RULES = {
    size: { min: 1, max: 100_000 },
    sizeOfYard: { min: 1, max: 1_000_000 },
    numOfRooms: { min: 1, max: 50, integer: true },
    numOfBathrooms: { min: 0, max: 50, integer: true },
    numOfBalconies: { min: 0, max: 50, integer: true },
    flatFloor: { min: -3, max: 100, integer: true },
    flatFloorFrom: { min: -3, max: 100, integer: true },
    price: { min: 1, max: 100_000_000 },
    maxGuests: { min: 1, max: 50, integer: true },
    minNights: { min: 1, max: 365, integer: true },
    yearBuilt: { min: 1800, max: CURRENT_YEAR + 5, integer: true },
    inDevelopmentUntil: { min: CURRENT_YEAR, max: CURRENT_YEAR + 15, integer: true },
}

const YOUTUBE_PATTERN = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

const STRING_RULES = {
    address: { max: 120 },
    builder: { max: 120 },
    externalId: { pattern: /^[\p{L}\p{N}_\-/]{1,32}$/u },
    video: { pattern: YOUTUBE_PATTERN, max: 300 },
    propertyDeed: { pattern: /^[a-zA-Z0-9_/-]+$/, max: 32 },
    propertyCadastralMunicipality: { max: 60 },
    checkInFrom: { pattern: TIME_PATTERN, time: true },
    checkOutUntil: { pattern: TIME_PATTERN, time: true },
}

// Fields set by the location matcher, the title builder or the description step are not re-checked for eligibility.
const ALWAYS_ELIGIBLE = new Set(["listingType", "type", "country", "city", "district", "name", "description"])

const inRange = (value, { min, max, integer }) =>
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max &&
    (!integer || Number.isInteger(value))

// `includeShortTerm: false` is for callers without the short-term-rent capability (older apps): that listing type and
// its stay fields are never returned, so they never see a value they cannot render.
export const verifyPrefill = (
    output = {},
    { text, locale = "mk", context = {}, actorKind = PREFILL_ACTOR.AGENCY, includeShortTerm = true } = {}
) => {
    const enabledListingTypes = getEnabledListingTypes({ includeShortTerm })
    const paddedText = ` ${normalizeText(text)} `
    const fields = {}
    let skipped = 0

    const grounded = entry => isEvidenceInText(entry?.evidence, paddedText)
    const accept = (key, entry, check = () => true) => {
        if (entry?.value === null || entry?.value === undefined) return
        if (grounded(entry) && check(entry.value, entry.evidence)) fields[key] = entry.value
        else skipped += 1
    }

    // 1. Listing type and type first: everything else is checked against them.
    accept("listingType", output.listingType, value => enabledListingTypes.includes(value))
    const listingType =
        fields.listingType ?? (enabledListingTypes.includes(context.listingType) ? context.listingType : undefined)

    accept(
        "type",
        output.type,
        value => Object.values(PropertyType).includes(value) && isPropertyTypeAllowed(listingType, value)
    )
    const type =
        fields.type ??
        (Object.values(PropertyType).includes(context.type) && isPropertyTypeAllowed(listingType, context.type)
            ? context.type
            : undefined)

    accept("propertySubType", output.propertySubType, value => Boolean(type) && getSubtypeValues(type).includes(value))

    // 2. Location: raw mentions → dictionary values (spec §5.4).
    accept("country", output.country, value => Object.values(PropertyCountry).includes(value))
    const country = fields.country ?? context.country ?? PropertyCountry.macedonia
    const mention = entry => {
        if (entry?.value === null || entry?.value === undefined) return null
        if (grounded(entry)) return entry.value
        skipped += 1
        return null
    }
    const location = matchPrefillLocation({
        cityMention: mention(output.cityMention),
        districtMention: mention(output.districtMention),
        country,
    })
    if (location.city) fields.city = location.city
    if (location.district) fields.district = location.district

    // 3. Numbers and years: the value must appear in its own evidence and fall inside a sane range.
    for (const key of [...NUMBER_KEYS, "yearBuilt", "inDevelopmentUntil"]) {
        accept(
            key,
            output[key],
            (value, evidence) => inRange(value, NUMBER_RULES[key]) && isNumberGrounded(value, evidence)
        )
    }
    if (
        fields.flatFloor !== undefined &&
        fields.flatFloorFrom !== undefined &&
        fields.flatFloor > fields.flatFloorFrom
    ) {
        delete fields.flatFloor
        delete fields.flatFloorFrom
        skipped += 2
    }

    // 4. Enums and flags.
    accept("orientation", output.orientation, value => Object.values(PropertyOrientation).includes(value))
    accept("priceUnit", output.priceUnit, value => Boolean(listingType) && isPriceUnitAllowed(listingType, value))
    accept("hasApproximatePrice", output.hasApproximatePrice, value => value === true)
    accept("inDevelopment", output.inDevelopment, value => value === true)
    if (fields.inDevelopmentUntil !== undefined && fields.inDevelopment !== true) {
        delete fields.inDevelopmentUntil
        skipped += 1
    }

    // 5. Strings: the value itself must be inside its evidence.
    for (const [key, rule] of Object.entries(STRING_RULES)) {
        const entry = output[key]
        if (typeof entry?.value === "string") entry.value = entry.value.trim()
        accept(key, entry, (value, evidence) => {
            if (typeof value !== "string" || value.length === 0) return false
            if (rule.max && value.length > rule.max) return false
            if (rule.pattern && !rule.pattern.test(value)) return false
            if (rule.time) return isNumberGrounded(Number(value.slice(0, 2)), evidence)
            return isValueInEvidence(value, evidence)
        })
    }
    if (Boolean(fields.propertyDeed) !== Boolean(fields.propertyCadastralMunicipality)) {
        delete fields.propertyDeed
        delete fields.propertyCadastralMunicipality
        skipped += 1
    }

    // 6. Amenities: true only, with evidence.
    for (const amenity of Array.isArray(output.amenities) ? output.amenities : []) {
        if (AMENITY_KEYS.includes(amenity?.key) && grounded(amenity)) fields[amenity.key] = true
        else skipped += 1
    }

    // 7. Eligibility for the resolved type/listing type (spec decision 17).
    for (const key of Object.keys(fields)) {
        if (ALWAYS_ELIGIBLE.has(key)) continue
        if (!isPrefillKeyEligible(key, { type, listingType, actorKind })) {
            delete fields[key]
            skipped += 1
        }
    }

    // 8. Title and description.
    if (actorKind !== PREFILL_ACTOR.CLIENT) {
        const name = buildPrefillTitle({
            listingType,
            type,
            numOfRooms: fields.numOfRooms,
            ...location,
            country,
            locale,
        })
        if (name) fields.name = name
    }
    const description = toPrefillDescription({ text, transformed: output.descriptionTransformed, actorKind })
    if (description) fields.description = description
    if (actorKind === PREFILL_ACTOR.CLIENT && fields.address) {
        const address = stripContactDetails(fields.address).trim()
        if (address) fields.address = address
        else delete fields.address
    }

    return { fields, skipped }
}
