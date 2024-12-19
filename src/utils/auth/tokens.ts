import { Response } from "express"
import { User } from "@prisma/client"
import jwt from "jsonwebtoken"
import prisma from "#prisma/prisma"

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

export { generateTokens, invalidateRefreshToken, clearRefreshTokenCookie, createRefreshTokenCookie }
