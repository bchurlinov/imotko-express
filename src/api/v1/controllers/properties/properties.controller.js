import { asyncHandler } from "#utils/helpers/async_handler.js"
import { getPropertiesService, getPropertyService } from "#services/properties/properties.service.js"

/**
 * Controller to get properties
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
export const getPropertiesController = asyncHandler(async (req, res) => {
    const properties = await getPropertiesService(req.query)
    return res.status(200).json(properties)
})

/**
 * Controller to get property by ID
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
export const getPropertyByIdController = async (req, res) => {
    const property = await getPropertyService(req.params.id)
    return res.status(200).json(property)
}
