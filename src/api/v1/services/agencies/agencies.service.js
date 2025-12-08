import prisma from "#database/client.js"

/**
 *  @typedef {import('#types/api.js').ApiResponse} ApiResponse
 *  @typedef {import('@prisma/client').Prisma.AgencyGetPayload<{ include: any }>} AgencyWithRelations
 */

/**
 * Get agency details by agency ID
 * @param {string} agencyId - Agency ID
 * @returns {Promise<ApiResponse<AgencyWithRelations>>}
 */
export const getAgencyService = async agencyId => {
    try {
        const agency = await prisma.agency.findUnique({
            where: { id: agencyId },
        })
        return {
            data: agency,
            message: "Agency details loaded successfully.",
        }
    } catch (err) {
        console.error("Error loading agency details:", err)
        throw new Error("Failed to load agency details.")
    }
}

/**
 * Get all agencies
 * @returns {Promise<ApiResponse<AgencyWithRelations[]>>}
 */
export const getAgenciesService = async () => {
    try {
        const agencies = await prisma.agency.findMany()
        return {
            data: agencies,
            message: "Agencies loaded successfully.",
        }
    } catch (err) {
        console.error("Error loading agencies:", err)
        throw new Error("Failed to load agencies.")
    }
}
