import { asyncHandler } from "#utils/helpers/async_handler.js"
import {
    createUserSearchService,
    getUserSearchesService,
    deleteUserSearchService,
} from "#services/users/users_searches.service.js"

/**
 * Controller to create a new client search
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
export const getUserSearchesController = asyncHandler(async (req, res) => {
    const userId = req.params.id
    const result = await getUserSearchesService(userId)
    return res.status(result.code).json(result)
})

/**
 * Controller to create a new client search
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
export const createUserSearchController = asyncHandler(async (req, res) => {
    const userId = req.params.id || null
    const result = await createUserSearchService(userId, req.body)
    return res.status(result.code).json(result)
})

/**
 * Controller to create a new client search
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
export const deleteUserSearchController = asyncHandler(async (req, res) => {
    const userId = req.params.id
    const searchId = req.params.searchId
    const result = await deleteUserSearchService(userId, searchId)
    return res.status(result.code).json(result)
})
