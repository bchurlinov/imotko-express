import propertiesRouter from "./properties/properties.routes.js"
import usersRouter from "./users/users.routes.js"
import agencyRouter from "./agencies/agencies.routes.js"
import analyticsRouter from "./analytics/analytics.routes.js"
import websiteRouter from "./website/website.routes.js"

/**
 * Initialize API routes
 * @param {import('express').Application} app - Express application
 * @returns {void}
 */
export default app => {
    app.use("/api/v1/properties", propertiesRouter)
    app.use("/api/v1/users", usersRouter)
    app.use("/api/v1/agencies", agencyRouter)
    app.use("/api/v1/analytics", analyticsRouter)
    app.use("/api/v1/website", websiteRouter)
}
