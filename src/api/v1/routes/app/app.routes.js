import { Router } from "express"
import { getAppConfig } from "#services/app/app_config.service.js"

const router = Router()

// No auth: app reads config before sign-in. Headers shape answer, so caches must keep callers apart.
router.get("/config", (req, res) => {
    res.set("Cache-Control", "private, max-age=300")
    res.set("Vary", "X-Imotko-Client, X-Imotko-App-Version")
    return res.status(200).json({ data: getAppConfig(req.capabilities), code: 200, message: null })
})

export default router
