import { AgencyApprovalStatus } from "#generated/prisma/enums.ts"
import prisma from "#database/client.js"

/**
 *  @typedef {import('#types/api.js').ApiResponse} ApiResponse
 *  @typedef {import('@prisma/client').Prisma.AgencyGetPayload<{ include: any }>} AgencyWithRelations
 */

/**
 * @typedef {Object} AgencyQueryParams
 * @property {string} [limit] - limit
 * @property {boolean} [shuffled] - whether to shuffle the results
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
 * @param {AgencyQueryParams} [params] - Query parameters
 * @returns {Promise<ApiResponse<AgencyWithRelations[]>>}
 */
export const getAgenciesService = async (params = {}) => {
    try {
        const { limit = 50, shuffled = false } = params

        const queryParams = {
            where: {
                status: AgencyApprovalStatus.ACTIVE,
            },
            take: parseInt(limit, 10),
            orderBy: {
                createdAt: "desc",
            },
        }

        let agencies = await prisma.agency.findMany(queryParams)
        if (shuffled) agencies = shuffleArray(agencies).slice(0, limit)

        return {
            data: agencies,
            message: "Agencies loaded successfully.",
        }
    } catch (err) {
        console.error("Error loading agencies:", err)
        throw new Error("Failed to load agencies.")
    }
}

const shuffleArray = array => {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
}
