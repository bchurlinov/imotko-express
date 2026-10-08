import propertiesRouter from "./properties/properties.routes.js"
import usersRouter from "./users/users.routes.js"
import agencyRouter from "./agencies/agencies.routes.js"
import analyticsRouter from "./analytics/analytics.routes.js"
import websiteRouter from "./website/website.routes.js"
import inquiriesRouter from "./inquiries/inquiries.routes.js"
import chatRouter from "./chat/chat.routes.js"
import adminChatRouter from "./admin/chat.routes.js"
import appRouter from "./app/app.routes.js"
import clientRouter from "./client/client.routes.js"
import uploadsRouter from "./uploads/uploads.routes.js"
import { attachClientCapabilities } from "#middlewares/client_capabilities.js"

/**
 * Initialize API routes
 * @param {import('express').Application} app - Express application
 * @returns {void}
 */
export default app => {
    app.use("/api/v1", attachClientCapabilities)
    app.use("/api/v1/app", appRouter)
    app.use("/api/v1/client", clientRouter)
    app.use("/api/v1/uploads", uploadsRouter)
    app.use("/api/v1/properties", propertiesRouter)
    app.use("/api/v1/users", usersRouter)
    app.use("/api/v1/agencies", agencyRouter)
    app.use("/api/v1/analytics", analyticsRouter)
    app.use("/api/v1/website", websiteRouter)
    app.use("/api/v1/inquiries", inquiriesRouter)
    app.use("/api/v1/chat", chatRouter)
    app.use("/api/v1/admin/chat", adminChatRouter)
}
