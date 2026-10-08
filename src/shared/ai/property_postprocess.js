// COPIED FROM imotko/src/lib/ai/property_postprocess.js (without: revalidateProperty) by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).
import { enrichPropertyOnCreate } from "./property_enrichment.js"
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

export const runPropertyAiPostprocess = async ({ propertyId, submittedBody, baselineUpdatedAt, userId }) => {
    try {
        const property = await prisma.property.findUnique({
            where: { id: propertyId },
            select: {
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
            },
        })

        if (!property) return

        const enrichmentInput = toEnrichmentInput(property, submittedBody)
        const enrichedBody = await enrichPropertyOnCreate(enrichmentInput, {
            sessionId: `property-${propertyId}`,
            distinctId: userId,
        })
        const propertyPatch = toPropertyPatch(property, enrichedBody)

        const result = await prisma.property.updateMany({
            where: {
                id: propertyId,
                updatedAt: baselineUpdatedAt,
            },
            data: propertyPatch,
        })

        if (result.count === 0) {
            console.info(`[AI_PROPERTY_POSTPROCESS] Skipped stale property update: ${propertyId}`)
            return
        }
    } catch (err) {
        console.error("[AI_PROPERTY_POSTPROCESS] Failed to postprocess property", err)
    }
}
