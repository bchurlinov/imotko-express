import { Router } from "express"
import { getPropertiesController, getPropertyByIdController } from "#controllers/properties/properties.controller.js"
import { query, param } from "express-validator"
import { validateRequest } from "#middlewares/validate_request.js"

const router = Router()

router.get("/", getPropertiesController)

router.get(
    "/:id",
    [param("id").notEmpty().withMessage("Property ID is required").trim()],
    validateRequest,
    getPropertyByIdController
)

export default router
