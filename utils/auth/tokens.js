import jwt from "jsonwebtoken"
import prisma from "#prisma/prisma.js"

const generateTokens = email => {
    const accessToken = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "15m" })
    const refreshToken = jwt.sign({ email }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: "60m" })
    return { accessToken, refreshToken }
}

const invalidateRefreshToken = async email => {
    return prisma.user.update({ where: { email }, data: { refreshToken: null } })
}

const clearRefreshTokenCookie = res => {
    res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Strict",
    })
}

const createRefreshTokenCookie = (res, refreshToken) => {
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Strict",
        maxAge: 24 * 60 * 60 * 1000, // 1 day
    })
}

export { generateTokens, invalidateRefreshToken, clearRefreshTokenCookie, createRefreshTokenCookie }
