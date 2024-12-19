import { tokens } from "#utils/auth"
import createError from "http-errors"
import prisma from "#prisma/prisma"
import jwt from "jsonwebtoken"

export const refreshTokenService = async (currentRefreshToken: any, currentAccessToken: any) => {
    if (!currentRefreshToken || !currentAccessToken) throw createError(403, "Unauthorized")

    // Find user with the refresh token
    const existingUser = await prisma.user.findFirst({ where: { refreshToken: currentRefreshToken } })

    if (!existingUser) {
        // Verify the token to determine if it's tampered with
        const decoded: any = jwt.verify(currentRefreshToken, process.env.REFRESH_TOKEN_SECRET as any)

        // If token verification passes but no user is found, clear the refresh token in DB
        if (decoded) {
            await prisma.user.update({
                where: { email: decoded.email },
                data: { refreshToken: null },
            })
        }
        throw createError(403, "Unauthorized")
    }

    let decoded: any
    try {
        decoded = jwt.verify(currentRefreshToken, process.env.REFRESH_TOKEN_SECRET as any)
    } catch (err) {
        await prisma.user.update({
            where: { email: existingUser.email },
            data: { refreshToken: null },
        })
        throw createError(403, "Unauthorized")
    }

    if (existingUser.email !== decoded.email) throw createError(403, "Unauthorized")
    const { accessToken, refreshToken } = tokens.generateTokens(existingUser.email)

    await prisma.user.update({
        where: { email: existingUser.email },
        data: { refreshToken },
    })

    return { accessToken, refreshToken }
}
