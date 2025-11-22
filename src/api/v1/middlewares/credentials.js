const allowedOrigins = [
    "https://www.yoursite.com",
    "http://127.0.0.1:5500",
    "http://localhost:3500",
    "http://localhost:3000",
]

/**
 * Middleware to handle CORS credentials for allowed origins
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {void}
 */
export const credentials = (req, res, next) => {
    const origin = req.headers.origin
    if (origin && allowedOrigins.includes(origin)) res.header("Access-Control-Allow-Credentials", "true")
    next()
}
