import { Router } from "express"
import { validateRequest } from "#middlewares/validate_request.js"
import { getAgencyController, getAgenciesController } from "#controllers/agencies/agencies.controller.js"

const router = Router()

router.get("/", validateRequest, getAgenciesController)
router.get("/:id", validateRequest, getAgencyController)

export default router
