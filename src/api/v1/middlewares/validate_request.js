import { validationResult } from "express-validator"
import createError from "http-errors"

/**
 * Middleware to validate request using express-validator
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {void}
 */
export const validateRequest = (req, res, next) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) throw createError(400, "Validation errors", { errors: errors.array() })
    next()
}
