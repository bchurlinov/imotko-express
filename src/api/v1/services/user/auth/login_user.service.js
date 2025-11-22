import { generateTokens } from "../../../../../utils/auth/tokens.js"
import createError from "http-errors"
import prisma from "../../../../../database/client.js"
import bcrypt from "bcryptjs"

/**
 * Service to login a user
 * @param {object} body - Login credentials
 * @param {string} body.email - User email
 * @param {string} body.password - User password
 * @returns {Promise<{accessToken: string, refreshToken: string, user: object}>} Authentication tokens and user
 */
export const loginUserService = async (body) => {
    const { email, password } = body

    if (!email || !password) throw createError(401, "Invalid credentials")

    // Find user
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) throw createError(401, "Invalid credentials")

    // Verify password
    const passwordsMatch = await bcrypt.compare(password, user.hashedPassword)
    if (!passwordsMatch) throw createError(401, "Invalid credentials")

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(email)

    // Clear old refresh token and update user with new refresh token
    const nextUser = await prisma.user.update({
        where: { email },
        data: { refreshToken: newRefreshToken },
    })

    return { accessToken, refreshToken: newRefreshToken, user: nextUser }
}
