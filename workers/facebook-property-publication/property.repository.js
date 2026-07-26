const connectionSelect = {
    id: true,
    revision: true,
    status: true,
    pageId: true,
    encryptedPageToken: true,
    pageTokenExpiresAt: true,
    dataAccessExpiresAt: true,
    grantedScopes: true,
    pageTasks: true,
}

const agencyConnectionSelect = {
    agency: {
        select: {
            facebookConnection: {
                select: connectionSelect,
            },
        },
    },
}

export function createPropertyRepository(prisma) {
    return {
        loadProperty: propertyId =>
            prisma.property.findUnique({
                where: { id: propertyId },
                select: {
                    id: true,
                    agencyId: true,
                    status: true,
                    publishToFacebook: true,
                    facebookPublishedAt: true,
                    slug: true,
                    name: true,
                    description: true,
                    photos: true,
                    listingType: true,
                    price: true,
                    hasApproximatePrice: true,
                    approximatePrice: true,
                    size: true,
                    district: true,
                    propertyLocation: { select: { name: true } },
                    ...agencyConnectionSelect,
                },
            }),

        loadPublicationGuard: propertyId =>
            prisma.property.findUnique({
                where: { id: propertyId },
                select: {
                    id: true,
                    agencyId: true,
                    status: true,
                    publishToFacebook: true,
                    facebookPublishedAt: true,
                    slug: true,
                    name: true,
                    description: true,
                    photos: true,
                    listingType: true,
                    ...agencyConnectionSelect,
                },
            }),

        invalidateConnection: ({ connectionId, revision, status, errorCode, errorAt }) =>
            prisma.agencyFacebookConnection.updateMany({
                where: { id: connectionId, revision },
                data: { status, lastErrorCode: errorCode, lastErrorAt: errorAt },
            }),

        async recordPublished(propertyId, publishedAt) {
            const result = await prisma.property.updateMany({
                where: { id: propertyId, facebookPublishedAt: null },
                data: { facebookPublishedAt: publishedAt },
            })
            if (result.count === 1) return { outcome: "recorded" }

            const property = await prisma.property.findUnique({
                where: { id: propertyId },
                select: { facebookPublishedAt: true },
            })
            if (!property) return { outcome: "deleted" }
            if (property.facebookPublishedAt) return { outcome: "already-recorded" }
            return { outcome: "not-recorded" }
        },
    }
}
