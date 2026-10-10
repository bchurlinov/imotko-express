// COPIED FROM imotko/src/lib/ai/property_prefill/schema.js by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).
import { z } from "zod"
import { PropertyCountry, PropertyOrientation, PropertyPriceUnit, PropertyType } from "#generated/prisma/enums.ts"
import { getEnabledListingTypes } from "../../property_rules/listing_type_rules.js"
import { AMENITY_KEYS, FLAG_KEYS, getSubtypeValues, NUMBER_KEYS, STRING_KEYS, YEAR_KEYS } from "./field_sets.js"

// Every field is nullable and carries a verbatim quote; verify.js drops anything the quote does not support.
const evidenced = valueSchema => z.object({ value: valueSchema.nullable(), evidence: z.string().nullable() })

const enumOf = values => z.enum([...new Set(values)])

export const buildPrefillOutputSchema = () =>
    z.object({
        listingType: evidenced(enumOf(getEnabledListingTypes())),
        type: evidenced(enumOf(Object.values(PropertyType))),
        propertySubType: evidenced(enumOf(getSubtypeValues())),
        country: evidenced(enumOf(Object.values(PropertyCountry))),
        cityMention: evidenced(z.string()),
        districtMention: evidenced(z.string()),
        orientation: evidenced(enumOf(Object.values(PropertyOrientation))),
        priceUnit: evidenced(enumOf(Object.values(PropertyPriceUnit))),
        ...Object.fromEntries(NUMBER_KEYS.map(key => [key, evidenced(z.number())])),
        ...Object.fromEntries(YEAR_KEYS.map(key => [key, evidenced(z.number())])),
        ...Object.fromEntries(STRING_KEYS.map(key => [key, evidenced(z.string())])),
        ...Object.fromEntries(FLAG_KEYS.map(key => [key, evidenced(z.boolean())])),
        amenities: z.array(z.object({ key: enumOf(AMENITY_KEYS), evidence: z.string() })),
        descriptionTransformed: z.string().nullable(),
    })
