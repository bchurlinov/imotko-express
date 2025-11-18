import { Router } from "express"
import { body } from "express-validator"
import { createUserController, loginUserController } from "@controllers/users/users.controller.js"
import { validateRequest } from "@middlewares/validate_request.js"
import { asyncHandler } from "@/utils/helpers/async_handler.js"

const router = Router()

const ALLOWED_LANGUAGES = ["EN", "MK", "AL", "SQ"]
const ALLOWED_ROLES = ["CLIENT", "AGENCY", "ADMIN"]

router.post(
    "/login",
    [
        body("email")
            .notEmpty()
            .withMessage("Email is required")
            .isEmail()
            .withMessage("Invalid email")
            .normalizeEmail(),
        body("password").notEmpty().withMessage("Password is required"),
    ],
    validateRequest,
    asyncHandler(loginUserController)
)

router.post(
    "/register",
    [
        body("email")
            .notEmpty()
            .withMessage("Email is required")
            .isEmail()
            .withMessage("Invalid email")
            .normalizeEmail(),
        body("password")
            .notEmpty()
            .withMessage("Password is required")
            .isLength({ min: 8 })
            .withMessage("Password must be at least 8 characters long"),
        body("name").notEmpty().withMessage("Name is required").isString().withMessage("Invalid name"),
        body("lastName").optional().isString().withMessage("Invalid last name"),
        body("phone").optional().isString().withMessage("Invalid phone"),
        body("location").optional().isString().withMessage("Invalid location"),
        body("language")
            .optional()
            .isString()
            .withMessage("Language must be a string")
            .customSanitizer(value => (typeof value === "string" ? value.toUpperCase() : value))
            .isIn(ALLOWED_LANGUAGES)
            .withMessage(`Language must be one of: ${ALLOWED_LANGUAGES.join(", ")}`),
        body("role")
            .optional()
            .isString()
            .withMessage("Role must be a string")
            .customSanitizer(value => (typeof value === "string" ? value.toUpperCase() : value))
            .isIn(ALLOWED_ROLES)
            .withMessage(`Role must be one of: ${ALLOWED_ROLES.join(", ")}`),
        body("metadata").optional().isObject().withMessage("Metadata must be an object"),
    ],
    validateRequest,
    asyncHandler(createUserController)
)

export default router
