import { loginUserService } from "#services/user/auth/login_user.service.js"
import { registerUserService } from "#services/user/auth/register_user.service.js"
import { logoutUserService } from "#services/user/auth/logout_user.service.js"
import { ip, tokens } from "#utils/auth/index.js"
import { refreshTokenService } from "#services/user/auth/refresh_token.service.js"
import { validationResult } from "express-validator"
import jwt from "jsonwebtoken"

/**
 * Controller to handle user login.
 * Validates the user's credentials and issues access and refresh tokens.
 * Detects and prevents token reuse or suspicious activity.
 *
 * @function loginUserController
 * @async
 * @param {Object} req - The Express request object.
 * @param {Object} req.body - The body of the request, containing user credentials.
 * @param {string} req.body.email - The user's email address.
 * @param {string} req.body.password - The user's password.
 * @param {Object} res - The Express response object.
 * @param {Function} next - The next middleware function.
 *
 * @throws {Error} Will call the `next` middleware with an error if an issue occurs.
 *
 * @example
 * // Request body:
 * // {
 * //   "email": "user@example.com",
 * //   "password": "password123"
 * // }
 *
 * @returns {Promise<void>} On success, responds with:
 * - HTTP 200: { accessToken: string }
 * - HTTP 400: Validation errors in the request body.
 * - HTTP 403: Suspicious activity detected (e.g., token reuse).
 * - HTTP 500: Internal server errors.
 */
export const loginUserController = async (req, res, next) => {
    try {
        const errors = validationResult(req)
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })
        const currentRefreshToken = req.cookies.refreshToken

        const { accessToken, refreshToken, user } = await loginUserService({ ...req.body })

        if (currentRefreshToken) {
            try {
                const decoded = jwt.verify(currentRefreshToken, process.env.REFRESH_TOKEN_SECRET)
                if (decoded.email === req.body.email && user.refreshToken !== currentRefreshToken) {
                    await tokens.invalidateRefreshToken(user.email)
                    tokens.clearRefreshTokenCookie(res)
                    return res.status(403).json({ message: "Suspicious activity detected. Please log in again." })
                }
            } catch (err) {
                console.log("Invalid token in cookies:", err.message)
                next(err)
            }
        }

        tokens.createRefreshTokenCookie(res, refreshToken)

        return res.status(200).json({ accessToken })
    } catch (err) {
        next(err)
    }
}

/**
 * Controller to handle user login.
 * This function authenticates the user, generates access and refresh tokens, and manages potential token reuse scenarios.
 *
 * @function loginUserController
 * @async
 * @param {Object} req - The Express request object.
 * @param {Object} req.body - The body of the request, containing user login credentials.
 * @param {string} req.body.email - The user's email address.
 * @param {string} req.body.password - The user's password.
 * @param {Object} req.cookies - The cookies sent with the request.
 * @param {string} [req.cookies.refreshToken] - The existing refresh token, if any.
 * @param {Object} res - The Express response object.
 * @param {Function} next - The next middleware function.
 *
 * @description
 * - Validates user input using `express-validator`.
 * - If a valid `refreshToken` is found in cookies, it checks for token reuse or suspicious activity.
 * - Generates a new `accessToken` and `refreshToken` on successful login.
 * - Sets a secure cookie for the new refresh token.
 *
 * @returns {Promise<void>} On success, responds with:
 * - HTTP 200: `{ accessToken: string }` - A new access token for the user.
 * - HTTP 400: `{ errors: Array }` - Validation errors in the request.
 * - HTTP 403: `{ message: string }` - Suspicious activity detected (e.g., token reuse).
 * - HTTP 500: Internal server errors passed to the `next` middleware.
 *
 * @throws {Error} Will pass errors to the `next` middleware if an issue occurs during token validation or generation.
 *
 * @example
 * // Request Body Example:
 * // {
 * //   "email": "user@example.com",
 * //   "password": "password123"
 * // }
 *
 * // Successful Response Example:
 * // HTTP 200
 * // {
 * //   "accessToken": "eyJhbGciOiJIUzI1..."
 * // }
 *
 * // Suspicious Activity Response Example:
 * // HTTP 403
 * // {
 * //   "message": "Suspicious activity detected. Please log in again."
 * // }
 */
export const registerUserController = async (req, res, next) => {
    try {
        const errors = validationResult(req)
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

        const ipAddress = ip.getIpAddress(req)
        const body = { ...req.body, ipAddress }

        const newUser = await registerUserService(body)
        return res.status(201).json({
            success: `New user with email ${newUser.email} created!`,
        })
    } catch (err) {
        console.error(err)
        next(err)
    }
}

/**
 * Controller to handle user logout.
 * Invalidates the user's refresh token and clears the associated cookie.
 *
 * @function logoutUserController
 * @async
 * @param {Object} req - The Express request object.
 * @param {Object} req.cookies - Cookies sent with the request.
 * @param {string} [req.cookies.refreshToken] - The refresh token to be invalidated.
 * @param {Object} res - The Express response object.
 * @param {Function} next - The next middleware function.
 *
 * @description
 * - Checks if a refresh token is provided in cookies.
 * - Calls the `logoutUserService` to invalidate the token in the database.
 * - Clears the `refreshToken` cookie, regardless of whether the token was valid.
 * - Always returns HTTP 204 (No Content), whether the token was valid or not.
 *
 * @returns {Promise<void>} On success, responds with:
 * - HTTP 204: No Content - The logout operation was completed successfully.
 *
 * @throws {Error} Passes errors to the `next` middleware if an issue occurs during token invalidation.
 *
 * @example
 * // Logout Request Example:
 * // Cookies: { refreshToken: "eyJhbGciOiJIUzI1..." }
 *
 * // Response Example:
 * // HTTP 204 No Content
 */
export const logoutUserController = async (req, res, next) => {
    try {
        const { refreshToken } = req.cookies
        if (!refreshToken) {
            tokens.clearRefreshTokenCookie(res)
            return res.sendStatus(204)
        }

        const isLoggedOut = await logoutUserService(refreshToken)
        tokens.clearRefreshTokenCookie(res)

        if (!isLoggedOut) return res.sendStatus(204)
        return res.sendStatus(204)
    } catch (err) {
        console.error(err)
        next(err)
    }
}

/**
 * Controller to handle token refreshing.
 * Generates a new access token and refresh token using the provided refresh token and invalidates the old tokens.
 *
 * @function refreshTokenController
 * @async
 * @param {Object} req - The Express request object.
 * @param {Object} req.cookies - The cookies sent with the request.
 * @param {string} req.cookies.refreshToken - The current refresh token.
 * @param {Object} req.headers - The headers sent with the request.
 * @param {string} req.headers.authorization - The authorization header containing the current access token.
 * @param {Object} res - The Express response object.
 * @param {Function} next - The next middleware function.
 *
 * @description
 * - Extracts the current refresh token from cookies and access token from the authorization header.
 * - Invalidates the old refresh token and access token.
 * - Calls the `refreshTokenService` to generate new tokens.
 * - Sets the new refresh token in an HTTP-only secure cookie.
 * - Responds with the new access token in the response body.
 *
 * @returns {Promise<void>} On success, responds with:
 * - HTTP 200: `{ accessToken: string }` - A new access token for the user.
 *
 * @throws {Error} Passes errors to the `next` middleware if an issue occurs during token validation or generation.
 *
 * @example
 * // Request Example:
 * // Cookies: { refreshToken: "eyJhbGciOiJIUzI1..." }
 * // Headers: { Authorization: "Bearer eyJhbGciOiJIUzI1..." }
 *
 * // Successful Response Example:
 * // HTTP 200
 * // {
 * //   "accessToken": "eyJhbGciOiJIUzI1..."
 * // }
 *
 * // Error Response Example:
 * // HTTP 401 Unauthorized (if the refresh token is invalid or expired)
 */
export const refreshTokenController = async (req, res, next) => {
    try {
        const cookies = req.cookies
        const authHeader = req.headers.authorization || req.headers.Authorization
        const currentAccessToken = authHeader.split(" ")[1]
        const currentRefreshToken = cookies.refreshToken

        tokens.clearRefreshTokenCookie(res)

        const { accessToken, refreshToken } = await refreshTokenService(currentRefreshToken, currentAccessToken)
        tokens.createRefreshTokenCookie(res, refreshToken)

        return res.status(200).json({ accessToken })
    } catch (err) {
        console.error(err)
        next(err)
    }
}
