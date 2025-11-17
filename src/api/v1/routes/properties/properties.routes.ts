import { Router } from "express"
import { listPropertiesController } from "@controllers/properties/properties.controller.js"

const router = Router()

router.get("/", listPropertiesController)

export default router
