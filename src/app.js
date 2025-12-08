import dotenv from "dotenv"
import express from "express"
import cookieParser from "cookie-parser"
import rateLimit from "express-rate-limit"
import helmet from "helmet"
import cors from "cors"
import morgan from "morgan"

// Routes
import initializeRoutes from "./api/v1/routes/index.js"

// Middlewares
import { errorMiddleware } from "./api/v1/middlewares/errorMiddleware.js"
import { credentials } from "./api/v1/middlewares/credentials.js"

// Jobs
import { scheduleAnalyticsRefresh } from "./jobs/refreshAnalytics.js"

dotenv.config()
const app = express()

// Handle Chrome DevTools inspector requests (must be before rate limiter)
// app.get(["/json/version", "/json/list", "/json"], (req, res) => {
//     res.status(404).end()
// })

// Log middleware - filter out Chrome DevTools inspector requests
app.use(morgan("dev"))

// credentials middleware
app.use(credentials)

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10000,
    standardHeaders: "draft-7",
    legacyHeaders: false,
})

app.set("trust proxy", false)
app.use(limiter)
app.use(helmet())
app.use(cors())

app.use(express.json())
app.use(cookieParser(process.env.JWT_SECRET))

// Initialize Routes
initializeRoutes(app)

// Error handling middleware
app.use(errorMiddleware)

const port = process.env.PORT || 5050
const start = () => {
    try {
        app.listen(port, () => {
            console.log(`Server is listening on port ${port}...`)
            if (process.env.NODE_ENV === "production") scheduleAnalyticsRefresh()
            else console.log("[Analytics] Scheduled refresh job disabled in development mode")
        })
    } catch (error) {
        console.log(error)
    }
}

start()
