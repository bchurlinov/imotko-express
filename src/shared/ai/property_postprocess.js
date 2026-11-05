import { PropertyAiStatus } from "#generated/prisma/enums.ts"
import { enrichPropertyOnCreate } from "./property_enrichment.js"
import { enrichPrivateProperty } from "./private_property_enrichment.js"
import { stripContactDetails } from "../property_rules/contact_details.js"
import { slugifyText } from "../property_rules/strings.js"
import { sanitizeServer } from "../property_rules/sanitize_server.js"
import prisma from "#database/client.js"

const ATTRIBUTE_KEYS = [
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
    "petFriendly",
    "fullyEquipped",
    "centralHeating",
    "utilityRoom",
    "fireplace",
    "gym",
    "solarPanels",
    "securitySystem",
    "soundProofing",
    "conferenceRoom",
    "serverRoom",
    "recreationalRoom",
]

const pickLocaleValue = (value, locale = "mk") => {
    if (typeof value === "string") return value
    return value?.[locale] || value?.mk || value?.en || value?.sq || ""
}

const getSubmittedAttributes = body =>
    Object.fromEntries(ATTRIBUTE_KEYS.map(key => [key, body?.[key]]).filter(([, value]) => value !== undefined))

const toEnrichmentInput = (property, submittedBody) => ({
    ...submittedBody,
    ...property.attributes,
    ...getSubmittedAttributes(submittedBody),
    name: submittedBody?.name || submittedBody?.nameMk || pickLocaleValue(property.name),
    nameMk: submittedBody?.nameMk || property.name?.mk,
    nameEn: submittedBody?.nameEn || property.name?.en,
    nameSq: submittedBody?.nameSq || property.name?.sq,
    nameTr: submittedBody?.nameTr || property.name?.tr,
    description: submittedBody?.description || submittedBody?.descriptionMk || pickLocaleValue(property.description),
    descriptionMk: submittedBody?.descriptionMk || property.description?.mk,
    descriptionEn: submittedBody?.descriptionEn || property.description?.en,
    descriptionSq: submittedBody?.descriptionSq || property.description?.sq,
    descriptionTr: submittedBody?.descriptionTr || property.description?.tr,
    address: submittedBody?.address || property.address,
    type: submittedBody?.type || property.type,
    listingType: submittedBody?.listingType || property.listingType,
    size: submittedBody?.size || property.size,
})

const getNextAttributes = (currentAttributes, enrichedBody) => ({
    ...(currentAttributes || {}),
    ...Object.fromEntries(
        ATTRIBUTE_KEYS.map(key => [key, enrichedBody?.[key]]).filter(([, value]) => value !== undefined)
    ),
})

const toPropertyPatch = (currentProperty, enrichedBody) => {
    const nameMk = enrichedBody.nameMk || enrichedBody.name || currentProperty.name?.mk
    const nameEn = enrichedBody.nameEn || enrichedBody.name || currentProperty.name?.en
    const nameSq = enrichedBody.nameSq || enrichedBody.name || currentProperty.name?.sq
    const nameTr = enrichedBody.nameTr || enrichedBody.name || currentProperty.name?.tr
    const descriptionMk = enrichedBody.descriptionMk || enrichedBody.description || currentProperty.description?.mk
    const descriptionEn = enrichedBody.descriptionEn || enrichedBody.description || currentProperty.description?.en
    const descriptionSq = enrichedBody.descriptionSq || enrichedBody.description || currentProperty.description?.sq
    const descriptionTr = enrichedBody.descriptionTr || enrichedBody.description || currentProperty.description?.tr

    return {
        name: {
            en: sanitizeServer(nameEn),
            mk: sanitizeServer(nameMk),
            sq: sanitizeServer(nameSq),
            tr: sanitizeServer(nameTr),
        },
        description: {
            en: sanitizeServer(descriptionEn),
            mk: sanitizeServer(descriptionMk),
            sq: sanitizeServer(descriptionSq),
            tr: sanitizeServer(descriptionTr),
        },
        address: sanitizeServer(enrichedBody.address || currentProperty.address),
        attributes: getNextAttributes(currentProperty.attributes, enrichedBody),
        slug: slugifyText(enrichedBody.name || nameMk) || currentProperty.slug || "nedviznina",
        updatedAt: new Date(),
    }
}

const stripLocalized = (value, format) =>
    Object.fromEntries(
        Object.entries(value || {}).map(([locale, text]) => [locale, stripContactDetails(text, { format })])
    )

// The AI step failed for a private listing: keep the seller's text minus whatever the regexes can remove, and flag it
// for the admin (private listing AI cleanup §3.6).
const toFailedPrivatePatch = property => ({
    name: stripLocalized(property.name, "plain"),
    description: stripLocalized(property.description, "html"),
    address: property.address ? stripContactDetails(property.address) : property.address,
    aiStatus: PropertyAiStatus.FAILED,
    updatedAt: new Date(),
})

// The agency step only flags the failure: its text was never touched, so there is nothing to strip.
export const toFailurePatch = property =>
    property.clientId ? toFailedPrivatePatch(property) : { aiStatus: PropertyAiStatus.FAILED, updatedAt: new Date() }

// Both outcomes are guarded: a newer edit has its own run and must not be overwritten.
export const writeIfUnchanged = async (propertyId, baselineUpdatedAt, data) => {
    const result = await prisma.property.updateMany({ where: { id: propertyId, updatedAt: baselineUpdatedAt }, data })
    if (result.count === 0) console.info(`[AI_PROPERTY_POSTPROCESS] Skipped stale property update: ${propertyId}`)
    return result.count > 0
}

const PROPERTY_SELECT = {
    id: true,
    name: true,
    description: true,
    address: true,
    attributes: true,
    slug: true,
    type: true,
    listingType: true,
    size: true,
    agencyId: true,
    ownerId: true,
    updatedAt: true,
}

export const STORED_PROPERTY_SELECT = {
    ...PROPERTY_SELECT,
    clientId: true,
    status: true,
    photos: true,
    district: true,
    propertyLocation: { select: { name: true, parent: { select: { name: true } } } },
    subcategory: { select: { value: true } },
}

// Enrichment input from the stored row alone (the worker has no request body). The city is the location path,
// e.g. "Скопје-Центар"; a location with no parent is just its own name.
export const toStoredEnrichmentInput = property => {
    const location = property.propertyLocation
    const city = location?.parent?.name ? `${location.parent.name}-${location.name}` : location?.name
    return toEnrichmentInput(property, {
        city,
        district: property.district,
        propertySubType: property.subcategory?.value,
    })
}

// Throws when the AI step fails: the caller decides between a retry and toFailurePatch.
// The enrichers are injectable so specs run without a model.
export const enrichStoredProperty = async (
    property,
    aiContext,
    { enrichPrivate = enrichPrivateProperty, enrichAgency = enrichPropertyOnCreate } = {}
) => {
    const input = toStoredEnrichmentInput(property)
    const enrichedBody = property.clientId ? await enrichPrivate(input, aiContext) : await enrichAgency(input, aiContext)
    return { ...toPropertyPatch(property, enrichedBody), aiStatus: PropertyAiStatus.DONE }
}
