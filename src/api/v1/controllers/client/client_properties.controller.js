import prisma from "#database/client.js"
import { PropertyStatus } from "#generated/prisma/enums.ts"
import { ClientListingError } from "#shared/property_rules/client_listing_error.js"
import {
    CLIENT_FREE_DAILY_RENEW,
    CLIENT_LISTING_COUNTED_STATUSES,
    CLIENT_LISTING_ERRORS,
    CLIENT_LISTING_LIMIT_PER_TYPE,
} from "#shared/property_rules/client_listings_constants.js"
import { getClientListingsOverview, getClientPropertyForEdit } from "#shared/property_rules/client_properties_data.js"
import { assertBelowListingLimit, getClientListingCounts } from "#shared/property_rules/limit.js"
import { buildClientListingData, validateClientListingInput } from "#shared/property_rules/listing_input.js"
import { loadOwnedProperty } from "#shared/property_rules/permissions.js"
import { withPlaceholderTitle } from "#shared/property_rules/placeholder_title.js"
import { spendClientCredits } from "#shared/property_rules/credits.js"
import { renewPropertyOncePerDay } from "#shared/property_rules/renew_policy.js"
import { PRICING_CREDITS } from "#shared/property_rules/pricing_credits.js"
import { resolvePropertyLocation } from "#shared/property_rules/property_location.js"
import { upsertPropertyTaxonomy } from "#shared/property_rules/property_dto.js"
import { slugifyText } from "#shared/property_rules/strings.js"
import { scheduleAiPostprocess } from "#services/client/client_ai.service.js"
import { clientJson } from "./client_listing_response.js"

export const listClientPropertiesController = async (req, res) => {
    const overview = await getClientListingsOverview(req.chatViewer.userId)
    if (!overview) throw new ClientListingError(CLIENT_LISTING_ERRORS.FORBIDDEN, 403)
    return clientJson(res, 200, null, {
        credits: overview.client.credits,
        limitPerType: CLIENT_LISTING_LIMIT_PER_TYPE,
        counts: overview.counts,
        agencyRequest: overview.agencyRequest,
        properties: overview.properties,
    })
}

export const getClientPropertyController = async (req, res) => {
    const property = await getClientPropertyForEdit(req.client.id, req.params.id)
    if (!property) throw new ClientListingError(CLIENT_LISTING_ERRORS.NOT_FOUND, 404)
    const counts = await getClientListingCounts(prisma, req.client.id)
    if (CLIENT_LISTING_COUNTED_STATUSES.includes(property.status)) counts[property.listingType] -= 1
    return clientJson(res, 200, null, { property, counts })
}

const EDIT_SELECT = { listingType: true, slug: true, photos: true, propertyPlan: true }

// Side effects that run after the response; specs replace them (no network in tests).
export const clientListingEffects = { scheduleAi: scheduleAiPostprocess }

const ownedOr404 = async (req, select = { slug: true }) => {
    const property = await loadOwnedProperty(prisma, {
        sessionUser: req.chatUser,
        clientId: req.client.id,
        propertyId: req.params.id,
        select,
    })
    if (!property) throw new ClientListingError(CLIENT_LISTING_ERRORS.NOT_FOUND, 404)
    return property
}

export const createClientPropertyController = async (req, res) => {
    const body = withPlaceholderTitle(req.body ?? {})
    const userId = req.chatViewer.userId
    const taxonomy = await validateClientListingInput({ body, userId })

    const property = await prisma.$transaction(
        async tx => {
            await assertBelowListingLimit(tx, req.client.id, body.listingType)
            const locationId = await resolvePropertyLocation(tx, body.city, body.country)
            const { categoryId, subcategoryId } = await upsertPropertyTaxonomy(tx, { type: body.type, ...taxonomy })
            return tx.property.create({
                data: {
                    ...buildClientListingData(body),
                    // Decision 102a: checked by default; only an explicit false opts out. Edits never touch it (127a).
                    agencyContactAllowed: body.agencyContactAllowed !== false,
                    slug: slugifyText(body.name) || "nedviznina",
                    poi: [],
                    bumpedAt: new Date(),
                    createdBy: userId,
                    client: { connect: { id: req.client.id } },
                    propertyLocation: { connect: { id: locationId } },
                    category: { connect: { id: categoryId } },
                    subcategory: { connect: { id: subcategoryId } },
                },
                select: { id: true, slug: true, status: true, listingType: true, updatedAt: true },
            })
        },
        { timeout: 10000 }
    )

    // Decision 118a: same AI translation/cleanup as on the web, after the response.
    clientListingEffects.scheduleAi({
        propertyId: property.id,
        submittedBody: body,
        baselineUpdatedAt: property.updatedAt,
        userId,
        listerKind: "private",
    })
    return clientJson(res, 201, "clientListingSubmitted", property)
}

// Decision 111a: like agency edits, a published listing is saved in place and hidden until the admin approves again.
export const updateClientPropertyController = async (req, res) => {
    const existing = await ownedOr404(req, EDIT_SELECT)
    const body = withPlaceholderTitle(req.body ?? {})
    const taxonomy = await validateClientListingInput({ body, userId: req.chatViewer.userId, existing })

    // A type change, or a DECLINED listing becoming PENDING, adds one counted listing of body.listingType.
    const needsLimitCheck =
        body.listingType !== existing.listingType || !CLIENT_LISTING_COUNTED_STATUSES.includes(existing.status)

    const property = await prisma.$transaction(
        async tx => {
            if (needsLimitCheck) {
                await assertBelowListingLimit(tx, req.client.id, body.listingType, { excludePropertyId: existing.id })
            }
            const locationId = await resolvePropertyLocation(tx, body.city, body.country)
            const { categoryId, subcategoryId } = await upsertPropertyTaxonomy(tx, { type: body.type, ...taxonomy })
            const updated = await tx.property.update({
                where: { id: existing.id },
                data: {
                    ...buildClientListingData(body),
                    updatedAt: new Date(),
                    propertyLocation: { connect: { id: locationId } },
                    category: { connect: { id: categoryId } },
                    subcategory: { connect: { id: subcategoryId } },
                },
                select: { id: true, slug: true, status: true, listingType: true, updatedAt: true },
            })
            await tx.propertySubmissionReview.deleteMany({ where: { propertyId: existing.id } })
            return updated
        },
        { timeout: 10000 }
    )
    // Edits rewrite the title and translations too (private listing AI cleanup §3.6).
    clientListingEffects.scheduleAi({
        propertyId: property.id,
        submittedBody: body,
        baselineUpdatedAt: property.updatedAt,
        userId: req.chatViewer.userId,
        listerKind: "private",
    })
    return clientJson(res, 200, "clientListingSubmitted", property)
}

// Soft delete: no reason, no PropertySale. Chat threads about the listing stay and show it as not available.
export const deleteClientPropertyController = async (req, res) => {
    const existing = await ownedOr404(req)
    const result = await prisma.property.updateMany({
        where: { id: existing.id, clientId: req.client.id, status: { not: PropertyStatus.DELETED } },
        data: { status: PropertyStatus.DELETED, autoRenewEnabled: false },
    })
    if (!result.count) throw new ClientListingError(CLIENT_LISTING_ERRORS.NOT_FOUND, 404)
    return clientJson(res, 200, "clientListingDeleted")
}

// Only PUBLISHED ↔ UNPUBLISHED. The status is part of the WHERE, so a listing that changed meanwhile answers 409.
export const setClientPropertyVisibilityController = async (req, res) => {
    const existing = await ownedOr404(req)
    if (typeof req.body?.visible !== "boolean") throw new ClientListingError("validationFailed", 400)
    const [from, to] = req.body.visible
        ? [PropertyStatus.UNPUBLISHED, PropertyStatus.PUBLISHED]
        : [PropertyStatus.PUBLISHED, PropertyStatus.UNPUBLISHED]
    const result = await prisma.property.updateMany({
        where: { id: existing.id, clientId: req.client.id, status: from },
        data: { status: to },
    })
    if (!result.count) throw new ClientListingError(CLIENT_LISTING_ERRORS.INVALID_STATUS, 409)
    return clientJson(res, 200, req.body.visible ? "clientListingShown" : "clientListingHidden")
}

// Decisions 102a and 127a: applies at once, in any status, without admin review.
export const setAgencyContactController = async (req, res) => {
    const existing = await ownedOr404(req)
    if (typeof req.body?.allowed !== "boolean") throw new ClientListingError("validationFailed", 400)
    await prisma.property.updateMany({
        where: { id: existing.id, clientId: req.client.id },
        data: { agencyContactAllowed: req.body.allowed },
    })
    return clientJson(res, 200, req.body.allowed ? "agencyContactAllowedSaved" : "agencyContactBlockedSaved", {
        agencyContactAllowed: req.body.allowed,
    })
}

// Decision 113: the instant bump only, at the agency price, paid in the same transaction.
// While CLIENT_FREE_DAILY_RENEW is on it is free instead, once per listing per calendar day.
export const bumpClientPropertyController = async (req, res) => {
    const property = await ownedOr404(req)
    if (property.status !== PropertyStatus.PUBLISHED) throw new ClientListingError(CLIENT_LISTING_ERRORS.INVALID_STATUS, 409)
    if (CLIENT_FREE_DAILY_RENEW) {
        const renewed = await renewPropertyOncePerDay(prisma, { propertyId: property.id, clientId: req.client.id })
        if (!renewed) throw new ClientListingError(CLIENT_LISTING_ERRORS.RENEW_LIMIT_REACHED, 409)
        return clientJson(res, 200, "propertyRestartSuccess")
    }
    const paid = await prisma.$transaction(async tx => {
        if (!(await spendClientCredits(tx, req.client.id, PRICING_CREDITS.restartProperty))) return false
        const now = new Date()
        await tx.property.update({ where: { id: property.id }, data: { bumpedAt: now, updatedAt: now } })
        return true
    })
    if (!paid) throw new ClientListingError(CLIENT_LISTING_ERRORS.NOT_ENOUGH_CREDITS, 402)
    return clientJson(res, 200, "propertyRestartSuccess")
}
