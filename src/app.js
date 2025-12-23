import "dotenv/config"
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
        // Add '0.0.0.0' as the second argument
        app.listen(port, "0.0.0.0", () => {
            console.log(`Server is listening on port ${port}...`)
        })
    } catch (error) {
        console.log(error)
    }
}

start()
