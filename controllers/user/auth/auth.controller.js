import { loginUserService } from "#services/user/auth/login_user.service.js"
import { registerUserService } from "#services/user/auth/register_user.service.js"
import { logoutUserService } from "#services/user/auth/logout_user.service.js"
import { ip, tokens } from "#utils/auth/index.js"
import { refreshTokenService } from "#services/user/auth/refresh_token.service.js"
import { validationResult } from "express-validator"
import jwt from "jsonwebtoken"

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
