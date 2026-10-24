import "dotenv/config"
import express from "express"
import cookieParser from "cookie-parser"
import helmet from "helmet"
import cors from "cors"
import morgan from "morgan"

// Routes
import initializeRoutes from "./api/v1/routes/index.js"

// Middlewares
import { errorMiddleware } from "./api/v1/middlewares/errorMiddleware.js"
import { attachRateLimitKey } from "./api/v1/middlewares/rateLimitKey.js"
import { createGlobalRateLimiter } from "./api/v1/middlewares/globalRateLimit.js"
import { createFaultInjection } from "./api/v1/middlewares/fault_injection.js"

// Config
import { corsOptions } from "./config/cors.config.js"
import { createRateLimitStore } from "./config/rateLimit.config.js"
import { closeRedisClient } from "./config/redis.js"
import { closeFacebookPublicationQueue } from "#services/properties/facebook_publication_queue.service.js"
import { isDebugIpRouteEnabled, resolveTrustProxyHops } from "./config/server.config.js"

// Database
import prisma from "./database/client.js"

const app = express()

// Liveness probe for the container orchestrator. Registered before logging, CORS and rate limiting so 30s probes
// neither flood the logs nor spend rate-limit budget, and it never touches the DB so a Supabase blip can't kill
// healthy containers.
app.get("/health", (req, res) => {
    res.set("Cache-Control", "no-store")
    res.status(200).json({ status: "ok" })
})

// Log middleware - filter out Chrome DevTools inspector requests
app.use(morgan("dev"))

// Verifies the proxy chain on a new host (req.ip must be the caller's public IP). Enabled only by DEBUG_IP_ROUTE=true.
if (isDebugIpRouteEnabled()) {
    app.get("/debug-ip-test-imotko", (req, res) => {
        res.json({ ip: req.ip, ips: req.ips, xff: req.headers["x-forwarded-for"] })
    })
}

// Global rate limiting: off unless RATE_LIMIT_ENABLED=true (see globalRateLimit.js).
// Requests carrying a valid X-Imotko-Internal-Secret (imotko web, imotko-templates) are not limited.
const limiter = createGlobalRateLimiter({ createStore: () => createRateLimitStore("global") })

// Railway: 2 hops (default). Dokploy VPS: TRUST_PROXY_HOPS=1 (Traefik -> app).
app.set("trust proxy", resolveTrustProxyHops())

// CORS runs before the rate limiter so 429 responses still carry CORS headers
// and the browser surfaces the real status instead of a generic CORS error
app.use(cors(corsOptions))
app.use(helmet())
app.use(attachRateLimitKey)
app.use(limiter)

// Client listings carry four-language texts and up to 20 photo objects; web allows 1 MB too.
app.use(express.json({ limit: "1mb" }))
app.use(cookieParser(process.env.JWT_SECRET))

// Local development only (ENV=development + ENABLE_FAULT_INJECTION=true): X-Imotko-Fault forces error responses
app.use(createFaultInjection())

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
        await closeFacebookPublicationQueue()
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
