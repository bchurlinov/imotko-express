import { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import createError from "http-errors"

export const verifyJWT = (req: Request, res: Response, next: NextFunction): void => {
    try {
        const authHeader = Array.isArray(req.headers.authorization)
            ? req.headers.authorization[0]
            : req.headers.authorization

        if (!authHeader?.startsWith("Bearer ")) return next(createError(401, "Unauthorized"))

        const token = authHeader.split(" ")[1]

        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || "", (err, decoded) => {
            if (err) {
                console.error("JWT Verification Error:", err.message)
                return next(createError(401, "Unauthenticated"))
            }

            // Attach the decoded user information to the request
            req.user = { email: (decoded as { email: string }).email }
            next()
        })
    } catch (err) {
        console.error("JWT Middleware Error:", err.message)
        return next(createError(500, "Internal Server Error"))
    }
}
