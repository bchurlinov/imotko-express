import { Router } from "express"
import { body } from "express-validator"
import { createUserController, findOrCreateUserController } from "#controllers/users/users.controller.js"
import { validateRequest } from "#middlewares/validate_request.js"

const router = Router()

const ALLOWED_LANGUAGES = ["EN", "MK", "AL", "SQ"]
const ALLOWED_ROLES = ["CLIENT", "AGENCY", "ADMIN"]

router.post(
    "/create-user",
    [
        body("fullName")
            .notEmpty()
            .withMessage("User name is required")
            .isString()
            .withMessage("User ID must be a string"),
        body("email")
            .notEmpty()
            .withMessage("User email is required")
            .isEmail()
            .withMessage("Invalid email")
            .normalizeEmail(),
        body("avatarUrl").isString().optional().isURL().withMessage("Avatar URL must be a valid URL"),
    ],
    validateRequest,
    findOrCreateUserController
)

// POST /api/v1/users - Create a new user manually
router.post(
    "/",
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
    createUserController
)

export default router
