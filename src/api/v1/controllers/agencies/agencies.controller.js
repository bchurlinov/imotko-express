import { asyncHandler } from "#utils/helpers/async_handler.js"
import { getAgencyService, getAgenciesService } from "#services/agencies/agencies.service.js"

/**
 * Controller to get properties
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
export const getAgencyController = asyncHandler(async (req, res) => {
    const agency = await getAgencyService(req.params.id)
    return res.status(200).json(agency)
})

/**
 * Controller to get all agencies
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */

export const getAgenciesController = asyncHandler(async (_, res) => {
    const agencies = await getAgenciesService()
    return res.status(200).json(agencies)
})
