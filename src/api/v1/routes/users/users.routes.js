import { Router } from "express"
import { body } from "express-validator"
import {
    createUserController,
    findOrCreateUserController,
    getUserNotificationsController,
    getUserController,
    patchNotificationStatusController,
    deleteNotificationController,
    propertyFavoriteController,
    propertyUnfavoriteController,
    getPropertiesFavoritesController,
} from "#controllers/users/users.controller.js"
import {
    createUserSearchController,
    getUserSearchesController,
    deleteUserSearchController,
} from "#controllers/users/users_search.controller.js"
import { validateRequest } from "#middlewares/validate_request.js"
import { verifySupabaseToken } from "#middlewares/verifySupabaseToken.js"

const router = Router()

const ALLOWED_LANGUAGES = ["EN", "MK", "AL", "SQ"]
const ALLOWED_ROLES = ["CLIENT", "AGENCY", "ADMIN"]

router.get("/", verifySupabaseToken, validateRequest, getUserController)

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

router.get("/:id/notifications", verifySupabaseToken, getUserNotificationsController)

router.patch("/:id/notifications/:notificationId/status", verifySupabaseToken, patchNotificationStatusController)

router.delete("/:id/notifications/:notificationId", verifySupabaseToken, deleteNotificationController)

router.post("/:id/favorites/:propertyId", verifySupabaseToken, propertyFavoriteController)

router.delete("/:id/favorites/:propertyId", verifySupabaseToken, propertyUnfavoriteController)

router.get("/:id/favorites", verifySupabaseToken, getPropertiesFavoritesController)

router.post("/:id/searches", verifySupabaseToken, createUserSearchController)

router.get("/:id/searches", verifySupabaseToken, getUserSearchesController)

router.delete("/:id/searches/:searchId", verifySupabaseToken, deleteUserSearchController)

export default router
