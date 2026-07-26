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
import { attachRateLimitKey } from "./api/v1/middlewares/rateLimitKey.js"

// Config
import { corsOptions } from "./config/cors.config.js"
import { createRateLimitStore, sharedRateLimitOptions } from "./config/rateLimit.config.js"
import { closeRedisClient } from "./config/redis.js"

// Database
import prisma from "./database/client.js"

const app = express()

// Log middleware - filter out Chrome DevTools inspector requests
app.use(morgan("dev"))

// app.get("/debug-ip-test-imotko", (req, res) => {
//     res.json({ ip: req.ip, ips: req.ips, xff: req.headers["x-forwarded-for"] })
// })

// Rate limiting - only apply in production, skip in development
// Authenticated requests are bucketed per Supabase user id, so mobile clients
// sharing a carrier NAT address do not exhaust each other's budget. Anonymous
// traffic still falls back to a (IPv6 /64 normalized) IP bucket.
const AUTHENTICATED_REQUEST_LIMIT = 500
const ANONYMOUS_REQUEST_LIMIT = 100

const limiter =
    process.env.ENV === "production"
        ? rateLimit({
              ...sharedRateLimitOptions,
              windowMs: 15 * 60 * 1000,
              limit: req => (req.rateLimitKey?.kind === "user" ? AUTHENTICATED_REQUEST_LIMIT : ANONYMOUS_REQUEST_LIMIT),
              keyGenerator: req => req.rateLimitKey?.key ?? `ip:${req.ip}`,
              store: createRateLimitStore("global"),
              standardHeaders: "draft-7",
              legacyHeaders: false,
              message: {
                  data: undefined,
                  code: 429,
                  message: "Too many requests, please try again later.",
              },
          })
        : (req, res, next) => next()

app.set("trust proxy", 2)

// CORS runs before the rate limiter so 429 responses still carry CORS headers
// and the browser surfaces the real status instead of a generic CORS error
app.use(cors(corsOptions))
app.use(helmet())
app.use(attachRateLimitKey)
app.use(limiter)

app.use(express.json())
app.use(cookieParser(process.env.JWT_SECRET))

initializeRoutes(app)
app.use(errorMiddleware)

const port = process.env.PORT || 5050
let server = null
let isShuttingDown = false

const start = () => {
    try {
        server = app.listen(port, "0.0.0.0", () => {
            console.log(`Server is listening on port ${port}...`)
        })
    } catch (error) {
        console.log(error)
    }
}

const shutdown = async (signal, code = 0) => {
    if (isShuttingDown) {
        console.log("⚠️  Shutdown already in progress...")
        return
    }
    isShuttingDown = true

    console.log(`\n${signal} received. Starting graceful shutdown...`)

    const forceExitTimeout = setTimeout(() => {
        console.error("⏰ Shutdown timeout reached, forcing exit")
        process.exit(1)
    }, 15000)

    forceExitTimeout.unref()

    try {
        if (server) {
            await new Promise((resolve, reject) => {
                server.close(err => {
                    if (err) return reject(err)
                    console.log("✅ HTTP server closed")
                    resolve()
                })
            })
        }

        console.log("🔌 Closing database connections...")
        await prisma.$disconnect()
        console.log("✅ Database connections closed")

        await closeRedisClient()
        console.log("✅ Redis connection closed")

        console.log("👋 Graceful shutdown complete")
        clearTimeout(forceExitTimeout)
        process.exit(code)
    } catch (error) {
        console.error("❌ Error during shutdown:", error)
        clearTimeout(forceExitTimeout)
        process.exit(1)
    }
}

// Handle shutdown signals
process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT", () => shutdown("SIGINT"))

// For uncaught exceptions, exit immediately without graceful shutdown
// The app state may be corrupted, so attempting cleanup could hang
process.on("uncaughtException", error => {
    console.error("💥 Uncaught Exception:", error)
    console.error("⚠️  Exiting immediately due to uncaught exception")
    process.exit(1)
})

// For unhandled rejections, attempt graceful shutdown
process.on("unhandledRejection", (reason, promise) => {
    console.error("💥 Unhandled Rejection at:", promise, "reason:", reason)
    shutdown("UNHANDLED_REJECTION", 1)
})

start()

const dbUrl = new URL(process.env.DATABASE_URL)

console.log("[db] host:", dbUrl.hostname)
console.log("[db] port:", dbUrl.port)
console.log("[db] pgbouncer:", dbUrl.searchParams.get("pgbouncer"))
