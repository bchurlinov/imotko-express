// Config-only server for the retired Railway host (mobile 1.1.0 has the Railway URL built in).
// It only answers /api/v1/app/config, so old apps see the forced-update screen, plus /health; every other route
// gets 410. Imports nothing that needs the database, Redis or other secrets.
// Railway start command: pnpm start:config-only
import express from "express"
import { pathToFileURL } from "node:url"
import { attachClientCapabilities } from "#middlewares/client_capabilities.js"
import appRouter from "#routes/app/app.routes.js"

export const createConfigOnlyApp = () => {
    const app = express()
    app.disable("x-powered-by")

    app.get("/health", (req, res) => res.status(200).json({ status: "ok" }))
    app.use("/api/v1", attachClientCapabilities)
    app.use("/api/v1/app", appRouter)
    app.use((req, res) =>
        res.status(410).json({
            data: null,
            code: 410,
            message: "This app version is no longer supported. Please update Imotko.",
        })
    )

    return app
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    // This server exists only to block old apps; a forgotten variable must not unblock them.
    process.env.MOBILE_MIN_SUPPORTED_VERSION ||= "1.1.1"
    process.env.MOBILE_LATEST_VERSION ||= process.env.MOBILE_MIN_SUPPORTED_VERSION
    const port = Number(process.env.PORT) || 5050
    createConfigOnlyApp().listen(port, () => console.log(`Config-only server listening on port ${port}`))
}
