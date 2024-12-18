import { generateTokens } from "#utils/auth/tokens.js"
import createError from "http-errors"
import prisma from "#prisma/prisma.js"
import jwt from "jsonwebtoken"

export const refreshTokenService = async (currentRefreshToken, currentAccessToken) => {
    if (!currentRefreshToken || !currentAccessToken) throw createError(403, "Unauthorized")

    // Find user with the refresh token
    const existingUser = await prisma.user.findFirst({ where: { refreshToken: currentRefreshToken } })

    if (!existingUser) {
        // Verify the token to determine if it's tampered with
        const decoded = jwt.verify(currentRefreshToken, process.env.REFRESH_TOKEN_SECRET)

        // If token verification passes but no user is found, clear the refresh token in DB
        if (decoded) {
            await prisma.user.update({
                where: { email: decoded.email },
                data: { refreshToken: null },
            })
        }
        throw createError(403, "Unauthorized")
    }

    let decoded
    try {
        decoded = jwt.verify(currentRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    } catch (err) {
        await prisma.user.update({
            where: { email: existingUser.email },
            data: { refreshToken: null },
        })
        throw createError(403, "Unauthorized")
    }

    if (existingUser.email !== decoded.email) throw createError(403, "Unauthorized")
    const { accessToken, refreshToken } = generateTokens(existingUser.email)

    await prisma.user.update({
        where: { email: existingUser.email },
        data: { refreshToken },
    })

    return { accessToken, refreshToken }
}
