import { Application } from "express"
import authRouter from "#routes/auth/auth"

export default (app: Application): void => {
    app.use("/api/auth", authRouter)
}
