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
import { schedulePropertyImport, stopPropertyImportJob } from "./jobs/schedulePropertyImport.js"

const app = express()

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

initializeRoutes(app)
app.use(errorMiddleware)

const port = process.env.PORT || 5050
let server = null

const start = () => {
    try {
        // Add '0.0.0.0' as the second argument
        server = app.listen(port, "0.0.0.0", () => {
            console.log(`Server is listening on port ${port}...`)

            // Task 7.1.4: Register scheduled jobs after server starts
            console.log("\n📅 Scheduling cron jobs...")
            scheduleAnalyticsRefresh()
            schedulePropertyImport()
            console.log("✅ All cron jobs scheduled\n")
        })
    } catch (error) {
        console.log(error)
    }
}

// Task 7.1.5: Graceful shutdown handling
const shutdown = signal => {
    console.log(`\n${signal} received. Starting graceful shutdown...`)

    // Stop accepting new requests
    if (server) {
        server.close(() => {
            console.log("✅ HTTP server closed")
        })
    }

    // Stop cron jobs
    console.log("🛑 Stopping scheduled jobs...")
    stopPropertyImportJob()
    console.log("✅ All scheduled jobs stopped")

    // Give running jobs time to complete (max 30 seconds)
    setTimeout(() => {
        console.log("⏰ Shutdown timeout reached, forcing exit")
        process.exit(0)
    }, 30000)
}

// Handle shutdown signals
process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT", () => shutdown("SIGINT"))

// Handle uncaught errors
process.on("uncaughtException", error => {
    console.error("💥 Uncaught Exception:", error)
    shutdown("UNCAUGHT_EXCEPTION")
})

process.on("unhandledRejection", (reason, promise) => {
    console.error("💥 Unhandled Rejection at:", promise, "reason:", reason)
    shutdown("UNHANDLED_REJECTION")
})

start()
