import {
    createUserService,
    findOrCreateUserService,
    getUserService,
    updateUserService,
    deleteUserService,
} from "#services/users/users.service.js"
import { asyncHandler } from "#utils/helpers/async_handler.js"
import { getUserNotificationsService } from "#services/users/users_notifications.service.js"
import {
    patchNotificationStatusService,
    deleteNotificationsService,
} from "#services/users/users_notifications.service.js"
import {
    usersCreatePropertiesFavoriteService,
    usersDeletePropertiesFavoriteService,
    getPropertiesFavoritesService,
} from "#services/users/users_properties_favorites.service.js"
import createError from "http-errors"

/**
 * Controller to find or create user from Supabase auth data
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
export const findOrCreateUserController = async (req, res, next) => {
    try {
        const email = req.body.email
        if (!email) throw createError(400, "Supabase user data is required")
        const { data } = await findOrCreateUserService(req.body)

        res.status(200).json({
            message: "User retrieved successfully",
            data,
        })
    } catch (error) {
        next(error)
    }
}

/**
 * Controller to find or create user from Supabase auth data
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
export const getUserController = asyncHandler(async (req, res) => {
    const { email } = req.user
    const { data, message } = await getUserService(email)
    return res.status(200).json({ data, message })
})

/**
 * Controller to create a new user
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
export const createUserController = async (req, res, next) => {
    try {
        const payload = {
            email: req.body.email,
            password: req.body.password,
            name: req.body.name,
            lastName: req.body.lastName,
            phone: req.body.phone,
            location: req.body.location,
            language: req.body.language,
            role: req.body.role,
            metadata: req.body.metadata,
        }

        const { user } = await createUserService(payload)

        res.status(201).json({
            message: "User created successfully",
            data: user,
        })
    } catch (error) {
        next(error)
    }
}

/**
 * Controller to delete existing user
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
export const deleteUserController = asyncHandler(async (req, res) => {
    const { id } = req.params
    const { sessionId } = req.body
    const response = await deleteUserService(id, sessionId)
    return res.status(200).json(response)
})
/**
 * Controller to update existing user
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
export const updateUserController = asyncHandler(async (req, res) => {
    const { id } = req.params
    const payload = {
        name: req.body.name,
        lastName: req.body.lastName,
        phone: req.body.phone,
        location: req.body.location,
    }

    const updatedUser = await updateUserService(id, payload)
    return res.status(200).json(updatedUser)
})

/**
 * Controller to update existing user
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
export const getUserNotificationsController = asyncHandler(async (req, res) => {
    const notifications = await getUserNotificationsService(req.params.id)
    return res.status(200).json(notifications)
})

/**
 * Controller to find or create user from Supabase auth data
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
export const patchNotificationStatusController = asyncHandler(async (req, res) => {
    const { notificationId } = req.params
    const { status } = req.body
    const result = await patchNotificationStatusService(notificationId, status)
    return res.status(200).json(result)
})

/**
 * Controller to find or create user from Supabase auth data
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
export const deleteNotificationController = asyncHandler(async (req, res) => {
    const { notificationId } = req.params
    const result = await deleteNotificationsService(notificationId)
    return res.status(200).json(result)
})

/**
 * Controller to add a property to user's favorites
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
export const propertyFavoriteController = asyncHandler(async (req, res) => {
    const { id: userId, propertyId } = req.params
    const result = await usersCreatePropertiesFavoriteService(userId, propertyId)
    return res.status(201).json(result)
})

/**
 * Controller to remove a property from user's favorites
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
export const propertyUnfavoriteController = asyncHandler(async (req, res) => {
    const { id: userId, propertyId } = req.params
    const result = await usersDeletePropertiesFavoriteService(userId, propertyId)
    return res.status(200).json(result)
})

/**
 * Controller to get users favorite propertties
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
export const getPropertiesFavoritesController = asyncHandler(async (req, res) => {
    const { id: userId } = req.params
    const result = await getPropertiesFavoritesService(userId)
    return res.status(200).json(result)
})
