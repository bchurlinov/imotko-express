// COPIED FROM imotko/src/lib/ai/private_property_enrichment.js by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).
import { generateText, Output } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"
import { PropertyListingType } from "#generated/prisma/enums.ts"
import { stripContactDetails } from "../property_rules/contact_details.js"
import { flushAiObservability, observeLanguageModel } from "./posthog_observability.js"
import {
    ATTRIBUTE_SCHEMA,
    getEligibleAttributeKeys,
    getExistingAttributes,
    mergeAttributes,
    toAttributePromptList,
} from "./property_enrichment.js"

// Private sellers are reached only through Imotko chat (private listing AI cleanup §3.5). Unlike the agency step this
// removes every contact detail and name, and writes the title from the description.
const LOCALES = ["mk", "en", "sq", "tr"]
const HARD_TITLE_LIMIT = 70

const localizedText = minimum => z.object(Object.fromEntries(LOCALES.map(locale => [locale, z.string().min(minimum)])))

const PRIVATE_ENRICHMENT_SCHEMA = z.object({
    name: localizedText(4),
    description: localizedText(20),
    address: z.string().nullable(),
    shouldReplaceAddress: z.boolean(),
    attributes: ATTRIBUTE_SCHEMA,
})

const SHORT_TERM_TITLE_EXAMPLES = [
    "Вила во село Дулица",
    "Луксузни вили во Маврово со стаклен поглед",
    "Апартман во Крушево идеален за едно семејство",
    "Апартман во Хиподром, Скопје",
    "Нова и модерна вила во Берово",
    "Апартмани во срцето на Берово",
    "Волшебни дрвени куќички во Лешок",
    "Вила на Попова Шапка достапна за цело друштво",
    "Планинска вила на Пониква изолирана во шума",
]

const SYSTEM =
    "You clean and translate private-seller real estate listings for Imotko. Buyers and agencies may contact a private " +
    "seller only through Imotko chat, so the output must never contain anything that identifies the seller or reaches " +
    "them outside Imotko. Return only schema-valid data. Never invent facts."

const mapLocales = (value, transform) => Object.fromEntries(LOCALES.map(locale => [locale, transform(value[locale])]))

// The prompt asks for at most 60 characters; this only guards runaway output.
export const clampTitle = (title, limit = HARD_TITLE_LIMIT) => {
    const clean = String(title || "")
        .replace(/\s+/g, " ")
        .trim()
    if (clean.length <= limit) return clean
    const cut = clean.slice(0, limit + 1)
    const lastSpace = cut.lastIndexOf(" ")
    return (lastSpace > 0 ? cut.slice(0, lastSpace) : clean.slice(0, limit)).replace(/[\s,.;:–-]+$/, "")
}

export const buildPrivateEnrichmentPrompt = body => `
Input listing:
${JSON.stringify(
    {
        description: body.description,
        address: body.address,
        type: body.type,
        propertySubType: body.propertySubType,
        listingType: body.listingType,
        city: body.city,
        district: body.district,
        size: body.size,
        existingAttributes: getExistingAttributes(body),
    },
    null,
    2
)}

Remove everywhere (every title locale, every description locale, the address):
- phone numbers, email addresses, URLs, website or domain names, social profiles and @handles
- messenger mentions used for contact (Viber, WhatsApp, Telegram, Instagram, Facebook, TikTok)
- booking platform references (Booking.com, Airbnb and similar)
- the name of the villa, apartment, guesthouse, complex or business, e.g. "Vila Vesna", "Apartmani Marija"
- names of people: the owner or anyone else, e.g. "контакт Марија", "кај Петре"
- sentences that only exist to give contact details, e.g. "Јавете се на ...", "За повеќе информации пишете ни"
After a removal, rewrite only the affected sentence so it still reads naturally,
e.g. "Вила Весна во Охрид нуди ..." -> "Вилата во Охрид нуди ...".
Keep place names even when they contain a person's name: streets, schools, landmarks, neighbourhoods,
e.g. "ОУ Владо Тасевски", "ул. Гоце Делчев", "Кеј Македонија".

Title rules (name.mk, name.en, name.sq, name.tr):
- Write the title from the description and the listing data. Every fact in the title must be stated in the description
  or the listing data. Never invent.
- name.mk in Macedonian Cyrillic, sentence case. name.en, name.sq and name.tr are faithful translations of name.mk.
- At most 60 characters.
- No size, price, codes, emojis, exclamation marks, names of people or of the property.
- listingType "${PropertyListingType.for_sale}": start with "Се продава". listingType "${PropertyListingType.for_rent}":
  start with "Се издава". Then the room count if the property is a flat and the description states it, the property
  type, the area, and a nearby landmark if the description names one.
  Example: "Се продава 3-собен стан во Козле, до ОУ Владо Тасевски".
- listingType "${PropertyListingType.short_term_rent}": no "Се издава" prefix; a short descriptive title like:
${SHORT_TERM_TITLE_EXAMPLES.map(example => `  - "${example}"`).join("\n")}
- If the area, room count or landmark is not clear, leave it out rather than invent it.

Description rules:
- description.mk is the cleaned original in Macedonian Cyrillic: same length, structure and paragraphs, NOT a summary.
- Allowed changes: Latin Macedonian to Cyrillic, all-uppercase text to sentence case, and the removals above.
- description.en, description.sq and description.tr are faithful translations of description.mk.
- Keep the input's HTML markup (<p>, <br>, <ul>, <li>, <strong>, <em>) in every locale.
- Never shorten, condense or drop anything other than the removals above.

Address rules:
- Return a short Macedonian Cyrillic location phrase from the description when possible, e.g. "Водно, во близина на
  школото", "Центар, кај амбасада", after the removals above.
- Set shouldReplaceAddress to true only when the current address is missing, too generic, or clearly nonsense.

Attribute rules:
- Only infer these attributes for this property type:
${toAttributePromptList(getEligibleAttributeKeys(body.type))}
- Keep existing valid attributes that are already present.
- Use true only when the description clearly supports the attribute.
- Use numeric values only when explicitly stated or strongly clear from the description.
- Use null when unknown.
`

// Throws on failure: runPropertyAiPostprocess records aiStatus FAILED and falls back to the regex cleanup.
export const enrichPrivateProperty = async (body, aiContext) => {
    try {
        const { output } = await generateText({
            model: observeLanguageModel(openai("gpt-5"), { ...aiContext, traceName: "private_property_enrichment" }),
            output: Output.object({ schema: PRIVATE_ENRICHMENT_SCHEMA }),
            // gpt-5 is a reasoning model: no temperature.
            providerOptions: { openai: { reasoningEffort: "low" } },
            system: SYSTEM,
            prompt: buildPrivateEnrichmentPrompt(body),
        })

        const name = mapLocales(output.name, title => clampTitle(stripContactDetails(title)))
        const description = mapLocales(output.description, text => stripContactDetails(text, { format: "html" }))
        const address = stripContactDetails(output.address || body.address)

        return {
            ...body,
            name: name.mk,
            nameMk: name.mk,
            nameEn: name.en,
            nameSq: name.sq,
            nameTr: name.tr,
            description: description.mk,
            descriptionMk: description.mk,
            descriptionEn: description.en,
            descriptionSq: description.sq,
            descriptionTr: description.tr,
            address: address || body.address,
            ...mergeAttributes(body, output.attributes),
        }
    } finally {
        flushAiObservability()
    }
}
