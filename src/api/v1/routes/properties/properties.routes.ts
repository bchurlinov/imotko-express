import { Router } from "express"
import { getPropertiesController } from "@controllers/properties/properties.controller.js"
import { query} from "express-validator"
import { validateRequest } from "@middlewares/validate_request.js"

const router = Router()

router.get(
    "/",
    [
        query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer").toInt(),
        query("limit").optional().isInt({ min: 1, max: 500 }).withMessage("Limit must be between 1 and 500").toInt(),
    ],
    validateRequest,
    getPropertiesController
)

export default router
