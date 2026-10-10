// COPIED FROM imotko/src/lib/ai/property_enrichment.js by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).
import { generateText, Output } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"
import { PropertyListingType, PropertyType } from "#generated/prisma/enums.ts"
import { PropertyFeaturesDictionary } from "../property_rules/dictionaries/property.js"
import { ensureContactInfoPreserved } from "./contact_preservation.js"
import { flushAiObservability, observeLanguageModel } from "./posthog_observability.js"

const NUMERIC_ATTRIBUTE_KEYS = new Set([
    "numOfBathrooms",
    "numOfRooms",
    "numOfBalconies",
    "sizeOfYard",
    "flatFloor",
    "flatFloorFrom",
])

const SUPPORTED_ATTRIBUTE_KEYS = [
    "numOfBathrooms",
    "numOfRooms",
    "numOfBalconies",
    "sizeOfYard",
    "parking",
    "woodenFloors",
    "elevator",
    "kitchen",
    "heating",
    "renovated",
    "cellar",
    "interphone",
    "new",
    "used",
    "goodCondition",
    "usedButGoodCondition",
    "furnished",
    "duplex",
    "garden",
    "airCon",
    "pool",
    "balcony",
    "flatFloor",
    "flatFloorFrom",
    "halfEmpty",
    "empty",
    "utilityRoom",
    "fireplace",
    "gym",
    "solarPanels",
    "securitySystem",
    "soundProofing",
    "conferenceRoom",
    "serverRoom",
    "recreationalRoom",
    "petFriendly",
    "fullyEquipped",
    "centralHeating",
    "personalHeating",
]

const ATTRIBUTE_DESCRIPTIONS = {
    numOfBathrooms: "number of bathrooms",
    numOfRooms: "number of rooms/bedrooms",
    numOfBalconies: "number of balconies/terraces",
    sizeOfYard: "yard size in square meters",
    parking: "parking",
    woodenFloors: "wooden floors/parquet",
    elevator: "elevator/lift",
    kitchen: "kitchen",
    heating: "heating",
    renovated: "renovated",
    cellar: "basement/cellar",
    interphone: "intercom",
    new: "new construction/new condition",
    used: "used/previously occupied",
    goodCondition: "good condition",
    usedButGoodCondition: "used but in good condition",
    furnished: "furnished",
    duplex: "duplex",
    garden: "garden",
    airCon: "air conditioner",
    pool: "pool",
    balcony: "balcony/terrace",
    flatFloor: "floor where the flat is located",
    flatFloorFrom: "total floors in the building",
    halfEmpty: "semi-furnished",
    empty: "unfurnished/empty",
    utilityRoom: "utility room",
    fireplace: "fireplace",
    gym: "gym",
    solarPanels: "solar panels",
    securitySystem: "security system",
    soundProofing: "sound proofing",
    conferenceRoom: "conference room",
    serverRoom: "server room",
    recreationalRoom: "recreational room",
    petFriendly: "pet friendly",
    fullyEquipped: "fully equipped",
    centralHeating: "central heating",
    personalHeating: "personal heating/parno",
}

export const ATTRIBUTE_SCHEMA = z.object(
    Object.fromEntries(
        SUPPORTED_ATTRIBUTE_KEYS.map(key => [
            key,
            NUMERIC_ATTRIBUTE_KEYS.has(key) ? z.number().nullable() : z.boolean().nullable(),
        ])
    )
)

const PROPERTY_ENRICHMENT_SCHEMA = z.object({
    name: z.object({
        mk: z.string().min(5),
        en: z.string().min(5),
        sq: z.string().min(5),
        tr: z.string().min(5),
    }),
    description: z.object({
        mk: z.string().min(20),
        en: z.string().min(20),
        sq: z.string().min(20),
        tr: z.string().min(20),
    }),
    address: z.string().nullable(),
    shouldReplaceAddress: z.boolean(),
    attributes: ATTRIBUTE_SCHEMA,
})

const isPresent = value => value !== undefined && value !== null && value !== ""

const normalizeBoolean = value => value === true || value === "true" || value === 1 || value === "1"

const normalizeNumber = value => {
    if (!isPresent(value)) return undefined
    const nextValue = Number(value)
    return Number.isFinite(nextValue) && nextValue > 0 ? nextValue : undefined
}

const mergeAttributeValue = (originalValue, enrichedValue, isNumeric) => {
    if (isNumeric) {
        const originalNumber = normalizeNumber(originalValue)
        if (originalNumber !== undefined) return originalValue

        const enrichedNumber = normalizeNumber(enrichedValue)
        return enrichedNumber !== undefined ? enrichedNumber : undefined
    }
    if (normalizeBoolean(originalValue)) return true
    return enrichedValue === true ? true : undefined
}

export const getEligibleAttributeKeys = type => {
    const visibleFeatureKeys = PropertyFeaturesDictionary.filter(feature => feature.visible.includes(type)).map(
        feature => feature.name
    )

    const manuallyVisibleKeys = [
        "numOfBathrooms",
        "numOfRooms",
        "numOfBalconies",
        ...(type === PropertyType.house ? ["sizeOfYard"] : []),
        ...(type === PropertyType.flat ? ["flatFloor", "flatFloorFrom"] : []),
        ...(type === PropertyType.flat || type === PropertyType.house ? ["duplex"] : []),
    ]

    return SUPPORTED_ATTRIBUTE_KEYS.filter(key => [...visibleFeatureKeys, ...manuallyVisibleKeys].includes(key))
}

export const getExistingAttributes = body =>
    Object.fromEntries(SUPPORTED_ATTRIBUTE_KEYS.map(key => [key, body?.[key]]).filter(([, value]) => isPresent(value)))

export const mergeAttributes = (body, enrichedAttributes = {}) => {
    const eligibleKeys = getEligibleAttributeKeys(body.type)

    return Object.fromEntries(
        eligibleKeys
            .map(key => {
                const value = mergeAttributeValue(
                    body?.[key],
                    enrichedAttributes?.[key],
                    NUMERIC_ATTRIBUTE_KEYS.has(key)
                )
                return [key, value]
            })
            .filter(([, value]) => value !== undefined)
    )
}

export const toAttributePromptList = keys =>
    keys.map(key => `- ${key}: ${ATTRIBUTE_DESCRIPTIONS[key] || key}`).join("\n")

export const enrichPropertyOnCreate = async (body, aiContext) => {
    try {
        const eligibleAttributeKeys = getEligibleAttributeKeys(body.type)
        const existingAttributes = getExistingAttributes(body)

        const { output } = await generateText({
            model: observeLanguageModel(openai("gpt-4o"), {
                ...aiContext,
                traceName: "property_enrichment",
            }),
            output: Output.object({
                schema: PROPERTY_ENRICHMENT_SCHEMA,
            }),
            system: "You enrich real estate listings for Imotko. Return only schema-valid data. Never invent facts that are not supported by the title, description, address, or given metadata.",
            prompt: `
Input listing:
${JSON.stringify(
    {
        title: body.name,
        description: body.description,
        address: body.address,
        type: body.type,
        listingType: body.listingType,
        city: body.city,
        district: body.district,
        size: body.size,
        existingAttributes,
    },
    null,
    2
)}

Supported listing types:
- ${PropertyListingType.for_sale}: Macedonian title starts with "Се продава"
- ${PropertyListingType.for_rent}: Macedonian title starts with "Се издава"
- ${PropertyListingType.short_term_rent}: Macedonian title starts with "Се издава за ноќевање"

Macedonian title rules:
- Always create name.mk in Macedonian Cyrillic.
- Convert Latin Macedonian text to Cyrillic, e.g. "se prodava kuka vo skopje" -> "се продава куќа во скопје".
- Convert all-uppercase titles to sentence case, e.g. "ПРЕКРАСЕН СТАН" -> "Прекрасен стан".
- Never allow codes in the title, internal agency codes, e.g. „ШИФРА 23451 Прекрасен 2-собен стан во Скопје“ -> Прекрасен 2-собен стан во Скопје". Avoid anything that resembles agency internal code.
- Remove phone numbers, email addresses, URLs, emojis, repeated punctuation, and contact/agency marketing text from name.mk.
- If the title is missing, generic, spammy, or unusable, create a concise Macedonian Cyrillic title from listingType, property type, district/city, and clearly stated room count.
- Never use property size in the title.
- Use strict short pattern: "[Се продава/Се издава/Се издава за ноќевање] [room-count if clear and if is of type flat, disregard this for house]-собен [property type] во [area], [nearby landmark if clear]".
- Use the pattern also when the translation is in macedonian as well, not just for latin.
- Examples: "Се продава 4-собен стан во Центар, кај амбасада", "Се издава куќа во Водно, во близина на школото", "Одличен деловен простор на атрактивна локација".
- If room count, area, or landmark is not clear, omit that fragment rather than invent it.

Description rules:
- description.mk is a transformed version of the original description, same length and structure, NOT a summary.
- You may only:
  1. transliterate Latin Macedonian to Macedonian Cyrillic
  2. convert all-uppercase text to sentence case
  3. translate faithfully for description.en, description.sq and description.tr
- Never shorten, condense, or drop trailing paragraphs, bullet lists, disclaimers, bank/financing notes, or sign-off lines.
- You MUST preserve all contact information exactly as written, copied character-for-character, including the entire line(s) it appears on:
  - phone numbers (every number listed, e.g. two mobile numbers must both remain)
  - email addresses
  - URLs
  - icons/emojis next to contact details (☎, ✉, etc.)
  - agency codes such as ШИФРА / SIFRA
  - any closing marketing/disclaimer sentence that precedes the contact block (e.g. bank financing cooperation notes)
- Do not remove, hide, mask, rewrite, normalize, summarize, or reformat contact information or the paragraph(s) around it.
- Every phone number, email, and URL present in the input description MUST also be present, unchanged, in description.mk, description.en, description.sq, and description.tr.

Address rules:
- Even if address is present make sure you derive it from the description anyway.
- Return a short Macedonian Cyrillic address/location phrase from the description when possible.
- Good examples: "Водно, во близина на школото", "Центар, кај амбасада".
- Set shouldReplaceAddress to true only when the current address is missing, too generic, or clearly nonsense.
- If current address is already useful, return it translated/transliterated to Macedonian and set shouldReplaceAddress to false.

Attribute rules:
- Only infer these attributes for this property type:
${toAttributePromptList(eligibleAttributeKeys)}
- Keep existing valid attributes that are already present.
- Use true only when the description clearly supports the attribute.
- Use numeric values only when explicitly stated or strongly clear from the title/description.
- Use null when unknown.
`,
            temperature: 0,
        })

        const mergedAttributes = mergeAttributes(body, output.attributes)

        const descriptionMk = ensureContactInfoPreserved(body.description, output.description.mk)
        const descriptionEn = ensureContactInfoPreserved(body.description, output.description.en)
        const descriptionSq = ensureContactInfoPreserved(body.description, output.description.sq)
        const descriptionTr = ensureContactInfoPreserved(body.description, output.description.tr)

        return {
            ...body,
            name: output.name.mk,
            nameMk: output.name.mk,
            nameEn: output.name.en,
            nameSq: output.name.sq,
            nameTr: output.name.tr,
            description: descriptionMk,
            descriptionMk,
            descriptionEn,
            descriptionSq,
            descriptionTr,
            address: output.address || body.address,
            ...mergedAttributes,
        }
    } catch (err) {
        console.error("[AI_PROPERTY_ENRICHMENT] Failed to enrich property", err)
        return body
    } finally {
        flushAiObservability()
    }
}
