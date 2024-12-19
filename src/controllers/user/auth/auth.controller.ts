import { Request, Response, NextFunction } from "express"
import { loginUserService } from "#services/user/auth/login_user.service"
import { registerUserService } from "#services/user/auth/register_user.service"
import { logoutUserService } from "#services/user/auth/logout_user.service"
import { ip, tokens } from "#utils/auth/"
import { refreshTokenService } from "#services/user/auth/refresh_token.service"
import { validationResult } from "express-validator"
import jwt from "jsonwebtoken"

export const loginUserController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            res.status(400).json({ errors: errors.array() })
            return
        }

        const currentRefreshToken = req.cookies.refreshToken
        const { accessToken, refreshToken, user }: any = await loginUserService({ ...req.body })

        if (currentRefreshToken) {
            try {
                const decoded: any = jwt.verify(currentRefreshToken, process.env.REFRESH_TOKEN_SECRET as any)
                if (decoded.email === req.body.email && user.refreshToken !== currentRefreshToken) {
                    await tokens.invalidateRefreshToken(user.email)
                    tokens.clearRefreshTokenCookie(res)
                    res.status(403).json({ message: "Suspicious activity detected. Please log in again." })
                    return
                }
            } catch (err) {
                console.error(err)
                next(err)
            }
        }

        tokens.createRefreshTokenCookie(res, refreshToken)
        res.status(200).json({ accessToken })
    } catch (err) {
        next(err)
    }
}

export const registerUserController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            res.status(400).json({ errors: errors.array() })
            return
        }

        const ipAddress = ip.getIpAddress(req)
        const body = { ...req.body, ipAddress }

        const newUser = await registerUserService(body)
        res.status(201).json({
            success: `New user with email ${newUser.email} created!`,
        })
    } catch (err) {
        console.error(err)
        next(err)
    }
}

export const logoutUserController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { refreshToken } = req.cookies
        if (!refreshToken) {
            tokens.clearRefreshTokenCookie(res)
            res.sendStatus(204)
            return
        }

        const isLoggedOut = await logoutUserService(refreshToken)
        tokens.clearRefreshTokenCookie(res)

        if (!isLoggedOut) res.sendStatus(204)
        res.sendStatus(204)
    } catch (err) {
        console.error(err)
        next(err)
    }
}

export const refreshTokenController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const cookies = req.cookies
        const authHeader = Array.isArray(req.headers.authorization)
            ? req.headers.authorization[0]
            : req.headers.authorization

        const currentAccessToken = authHeader.split(" ")[1]
        const currentRefreshToken = cookies.refreshToken

        tokens.clearRefreshTokenCookie(res)

        const { accessToken, refreshToken } = await refreshTokenService(currentRefreshToken, currentAccessToken)
        tokens.createRefreshTokenCookie(res, refreshToken)

        res.status(200).json({ accessToken })
    } catch (err) {
        console.error(err)
        next(err)
    }
}
