import { v4 as uuidv4 } from "uuid"
import jwt from "jsonwebtoken"
import prisma from "../../database/client.js"

/**
 * Generate access and refresh tokens for a user
 * @param {string} email - The user's email
 * @returns {{ accessToken: string, refreshToken: string }} The generated tokens
 */
const generateTokens = (email) => {
    const accessToken = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "15m" })
    const refreshToken = jwt.sign({ email }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: "60m" })
    return { accessToken, refreshToken }
}

/**
 * Invalidate a user's refresh token
 * @param {string} email - The user's email
 * @returns {Promise<Partial<import('@prisma/client').User>>} The updated user
 */
const invalidateRefreshToken = async (email) => {
    return prisma.user.update({ where: { email }, data: { refreshToken: null } })
}

/**
 * Clear the refresh token cookie
 * @param {import('express').Response} res - The Express response object
 * @returns {void}
 */
const clearRefreshTokenCookie = (res) => {
    res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
    })
}

/**
 * Create a refresh token cookie
 * @param {import('express').Response} res - The Express response object
 * @param {string} refreshToken - The refresh token to store
 * @returns {void}
 */
const createRefreshTokenCookie = (res, refreshToken) => {
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000, // 1 day
    })
}

/**
 * Generate a verification token for email verification
 * @param {string} email - The user's email
 * @returns {Promise<import('@prisma/client').VerificationToken>} The generated verification token
 */
const generateVerificationToken = async (email) => {
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
