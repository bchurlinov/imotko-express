import jwt from "jsonwebtoken";
import createError from "http-errors";
export const verifyJWT = (req, res, next) => {
    try {
        const authHeader = Array.isArray(req.headers.authorization)
            ? req.headers.authorization[0]
            : req.headers.authorization;
        if (!authHeader?.startsWith("Bearer "))
            return next(createError(401, "Unauthorized"));
        const token = authHeader.split(" ")[1];
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || "", (err, decoded) => {
            if (err) {
                console.error("JWT Verification Error:", err.message);
                return next(createError(401, "Unauthenticated"));
            }
            // Attach the decoded user information to the request
            // req.user = { email: (decoded as { email: string }).email }
            next();
        });
    }
    catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown verification error");
        console.error("JWT Middleware Error:", error.message);
        return next(createError(500, "Internal Server Error"));
    }
};
