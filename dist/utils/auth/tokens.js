import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import prisma from "../../database/client.js";
const generateTokens = (email) => {
    const accessToken = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "15m" });
    const refreshToken = jwt.sign({ email }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: "60m" });
    return { accessToken, refreshToken };
};
const invalidateRefreshToken = async (email) => {
    return prisma.user.update({ where: { email }, data: { refreshToken: null } });
};
const clearRefreshTokenCookie = (res) => {
    res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
    });
};
const createRefreshTokenCookie = (res, refreshToken) => {
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000, // 1 day
    });
};
const generateVerificationToken = async (email) => {
    const token = uuidv4();
    const expires = new Date(new Date().getTime() + 3600 * 1000);
    const existingVerificationToken = await prisma.verificationToken.findFirst({
        where: { email },
    });
    if (existingVerificationToken) {
        await prisma.verificationToken.delete({
            where: {
                id: existingVerificationToken.id,
            },
        });
    }
    return prisma.verificationToken.create({
        data: {
            email,
            token,
            expires,
        },
    });
};
export { generateTokens, invalidateRefreshToken, clearRefreshTokenCookie, createRefreshTokenCookie, generateVerificationToken, };
