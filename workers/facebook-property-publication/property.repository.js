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

        // Republication overwrites an existing timestamp: the write is unconditional so
        // that a second post for the same property records when it actually happened.
        // updateMany keeps a concurrently deleted property from throwing after Facebook
        // has already accepted the post.
        async recordPublished(propertyId, publishedAt) {
            const result = await prisma.property.updateMany({
                where: { id: propertyId },
                data: { facebookPublishedAt: publishedAt },
            })
            if (result.count === 1) return { outcome: "recorded" }

            const property = await prisma.property.findUnique({
                where: { id: propertyId },
                select: { id: true },
            })
            return property ? { outcome: "not-recorded" } : { outcome: "deleted" }
        },
    }
}
