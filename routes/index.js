import authRouter from "./auth/auth.js"

export default app => {
    app.use("/api/auth", authRouter)
}
