import { generateTokens } from "#utils/auth/tokens"
import createError from "http-errors"
import prisma from "#prisma/prisma"
import bcrypt from "bcryptjs"

export const loginUserService = async (body: any) => {
    const { email, password } = body

    if (!email || !password) throw createError(401, "Invalid credentials")

    // Find user
    const user: any = await prisma.user.findUnique({ where: { email } })
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
