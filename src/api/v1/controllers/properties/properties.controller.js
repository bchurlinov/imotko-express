import { getProperties } from "#services/properties/properties.service.js"

/**
 * Controller to get properties
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
export const getPropertiesController = async (req, res, next) => {
    try {
        const properties = await getProperties(req.query)
        return res.status(200).json(properties)
    } catch (error) {
        console.error("Error fetching properties:", error)
        next(error)
    }
}
