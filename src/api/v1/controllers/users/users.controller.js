import { createUserService, findOrCreateUserService } from "#services/users/users.service.js"
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
        // Expecting the Supabase user object from req.body.user
        const email = req.body.email

        if (!email) throw createError(400, "Supabase user data is required")
        const { user } = await findOrCreateUserService(req.body)

        res.status(200).json({
            message: "User retrieved successfully",
            data: user,
        })
    } catch (error) {
        next(error)
    }
}

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
