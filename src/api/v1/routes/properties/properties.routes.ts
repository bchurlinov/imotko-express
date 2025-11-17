import { Router } from "express"
import { getPropertiesController } from "@controllers/properties/properties.controller.js"

const router = Router()

router.get("/", getPropertiesController)

export default router
