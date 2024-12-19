import authRouter from "./auth/auth"

export default (app: any) => {
    app.use("/api/auth", authRouter)
}
