import { createUserService } from "#services/users/users.service.js"

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
