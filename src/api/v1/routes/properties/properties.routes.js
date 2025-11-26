import { Router } from "express"
import { getPropertiesController, getPropertyByIdController } from "#controllers/properties/properties.controller.js"
import { query, param } from "express-validator"
import { validateRequest } from "#middlewares/validate_request.js"
import { verifySupabaseToken } from "#middlewares/verifySupabaseToken.js"

const router = Router()

router.get(
    "/",
    [
        // verifySupabaseToken,
        query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer").toInt(),
        query("limit").optional().isInt({ min: 1, max: 500 }).withMessage("Limit must be between 1 and 500").toInt(),
    ],
    validateRequest,
    getPropertiesController
)

router.get(
    "/:id",
    [
        // verifySupabaseToken,
        param("id").notEmpty().withMessage("Property ID is required").trim(),
    ],
    validateRequest,
    getPropertyByIdController
)

export default router
