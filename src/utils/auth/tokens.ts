import { Response } from "express"
import type { User } from "@prisma/client"
import { v4 as uuidv4 } from "uuid"
import type { VerificationToken } from "@prisma/client"
import jwt from "jsonwebtoken"
import prisma from "../../database/client.js"

const generateTokens = (email: string): { accessToken: string; refreshToken: string } => {
    const accessToken: string = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET as any, { expiresIn: "15m" })
    const refreshToken: string = jwt.sign({ email }, process.env.REFRESH_TOKEN_SECRET as any, { expiresIn: "60m" })
    return { accessToken, refreshToken }
}

const invalidateRefreshToken = async (email: string): Promise<Partial<User>> => {
    return prisma.user.update({ where: { email }, data: { refreshToken: null } })
}

const clearRefreshTokenCookie = (res: Response): void => {
    res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
    })
}

const createRefreshTokenCookie = (res: Response, refreshToken: string): void => {
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000, // 1 day
    })
}

const generateVerificationToken = async (email: string): Promise<VerificationToken> => {
    const token = uuidv4()
    const expires = new Date(new Date().getTime() + 3600 * 1000)

    const existingVerificationToken = await prisma.verificationToken.findFirst({
        where: { email },
    })

    if (existingVerificationToken) {
        await prisma.verificationToken.delete({
            where: {
                id: existingVerificationToken.id,
            },
        })
    }

    return prisma.verificationToken.create({
        data: {
            email,
            token,
            expires,
        },
    })
}

export {
    generateTokens,
    invalidateRefreshToken,
    clearRefreshTokenCookie,
    createRefreshTokenCookie,
    generateVerificationToken,
}
