import jwt from "jsonwebtoken"
import createError from "http-errors"

export const verifyJWT = (req, res, next) => {
    try {
        // Check if the accessToken exists in cookies
        const authHeader = req.headers.authorization || req.headers.Authorization
        if (!authHeader?.startsWith("Bearer ")) return next(createError(401, "Unauthorized")) // No token in cookies
        const token = authHeader.split(" ")[1]

        // Verify the token
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
            if (err) {
                console.error("JWT Verification Error:", err.message)
                return next(createError(401, "Unauthenticated"))
            }

            // Attach the decoded user information to the request
            req.user = decoded.email
            next()
        })
    } catch (err) {
        console.error("JWT Middleware Error:", err.message)
        return next(createError(500, "Internal Server Error"))
    }
}
