import dotenv from "dotenv"
import express from "express"
import cookieParser from "cookie-parser"
import rateLimit from "express-rate-limit"
import helmet from "helmet"
// @ts-ignore
import xss from "xss-clean"
import cors from "cors"
import morgan from "morgan"

// Routes
import initializeRoutes from "./routes"

// Middlewares
import { errorMiddleware } from "./middlewares/errorMiddleware"
import { credentials } from "./middlewares/credentials"
import { verifyJWT } from "./middlewares/verifyJWT"

// Route imports
// import { authRouter } from "./routes/index.js"

dotenv.config()
const index = express()

// Log middleware
index.use(morgan("dev"))

// credentials middleware
index.use(credentials)

// custom middleware logger
// app.use(logger)

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: "draft-7",
    legacyHeaders: false,
})

index.set("trust proxy", false)
index.use(limiter)
index.use(helmet())
index.use(cors())
index.use(xss())

index.use(express.json())
index.use(cookieParser(process.env.JWT_SECRET))

// Initialize Routes
initializeRoutes(index)

index.get("/api/users", verifyJWT, (req: any, res: any, next: any) => {
    return res.status(200).send([1, 2, 3])
})

// Error handling middleware
index.use(errorMiddleware)

const port = process.env.PORT || 5050
const start = () => {
    try {
        index.listen(port, () => console.log(`Server is listening on port ${port}...`))
    } catch (error) {
        console.log(error)
    }
}

start()
