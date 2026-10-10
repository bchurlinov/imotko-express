// COPIED FROM imotko/src/data/client_properties/client_properties.js (without: getClientDashboardOverview, getSavedSearchWhere) by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).
import { AgencyApprovalStatus, PropertyStatus, UserRole } from "#generated/prisma/enums.ts"
import { getClientListingCounts } from "./limit.js"
import { withPublicImages } from "./public_images.js"
import prisma from "#database/client.js"
import { canRenewToday } from "./renew_policy.js"

const LIST_SELECT = {
    id: true,
    name: true,
    slug: true,
    status: true,
    listingType: true,
    price: true,
    priceUnit: true,
    photos: true,
    createdAt: true,
    agencyContactAllowed: true,
    bumpedAt: true,
    propertyReview: { orderBy: { createdAt: "desc" }, take: 1, select: { title: true, description: true } },
}

export const getClientByUser = userId =>
    prisma.client.findUnique({ where: { userId }, select: { id: true, credits: true } })

export const getClientProperties = clientId =>
    prisma.property.findMany({
        where: { clientId, status: { not: PropertyStatus.DELETED } },
        orderBy: { createdAt: "desc" },
        select: LIST_SELECT,
    })

// An open "Стани агенција" request: an agency the person owns while still a CLIENT (design B §2).
export const getClientAgencyRequest = userId =>
    prisma.agency.findFirst({
        where: {
            ownerId: userId,
            status: { in: [AgencyApprovalStatus.PENDING, AgencyApprovalStatus.DECLINED] },
            agencyOwner: { role: UserRole.CLIENT },
        },
        select: {
            id: true,
            status: true,
            name: true,
            address: true,
            location: true,
            phone: true,
            AgencySubmissionReview: { select: { title: true, description: true } },
        },
    })

export const getClientListingsOverview = async userId => {
    const client = await getClientByUser(userId)
    if (!client) return null
    const [properties, counts, agencyRequest, views] = await Promise.all([
        getClientProperties(client.id),
        getClientListingCounts(prisma, client.id),
        getClientAgencyRequest(userId),
        prisma.propertyView.count({
            where: { property: { clientId: client.id, status: { not: PropertyStatus.DELETED } } },
        }),
    ])
    const now = new Date()
    const withRenewState = property => ({
        ...withPublicImages(property),
        canRenew: canRenewToday(property.bumpedAt, now),
    })
    return { client, properties: properties.map(withRenewState), counts, agencyRequest, views }
}

// Same shape as the agency edit page loads (getPropertyByAgency), scoped to the owner.
export const getClientPropertyForEdit = (clientId, propertyId) =>
    prisma.property.findFirst({
        where: { id: propertyId, clientId, status: { not: PropertyStatus.DELETED } },
        omit: { modifications: true },
        include: { propertyLocation: { include: { parent: true } }, category: true, subcategory: true },
    })
