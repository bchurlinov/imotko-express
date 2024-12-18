import "module-alias/register.js"
import dotenv from "dotenv"
import express from "express"
import cookieParser from "cookie-parser"
import rateLimit from "express-rate-limit"
import helmet from "helmet"
import xss from "xss-clean"
import cors from "cors"
import morgan from "morgan"

// Routes
import initializeRoutes from "#routes/index.js"

// Middlewares
import { errorMiddleware } from "#middlewares/errorMiddleware.js"
import { credentials } from "#middlewares/credentials.js"
import { verifyJWT } from "#middlewares/verifyJWT.js"

// Route imports
// import { authRouter } from "./routes/index.js"

dotenv.config()
const app = express()

// Log middleware
app.use(morgan("dev"))

// credentials middleware
app.use(credentials)

// custom middleware logger
// app.use(logger)

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: "draft-7",
    legacyHeaders: false,
})

app.set("trust proxy", false)
app.use(limiter)
app.use(helmet())
app.use(cors())
app.use(xss())

app.use(express.json())
app.use(cookieParser(process.env.JWT_SECRET))

// Initialize Routes
initializeRoutes(app)

app.get("/api/users", verifyJWT, (req, res, next) => {
    return res.status(200).send([1, 2, 3])
})

// Error handling middleware
app.use(errorMiddleware)

const port = process.env.PORT || 5050
const start = () => {
    try {
        app.listen(port, () => console.log(`Server is listening on port ${port}...`))
    } catch (error) {
        console.log(error)
    }
}

start()
