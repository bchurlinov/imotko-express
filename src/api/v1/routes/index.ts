import { Application } from "express"
import authRouter from "./auth/auth.routes.js"
import propertiesRouter from "./properties/properties.routes.js"

export default (app: Application): void => {
    app.use("/api/v1/auth", authRouter)
    app.use("/api/v1/properties", propertiesRouter)
}
