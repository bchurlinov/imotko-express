import { Router } from "express"
import rateLimit from "express-rate-limit"
import { body, param } from "express-validator"
import {
    checkUserRoleController,
    createUserController,
    findOrCreateUserController,
    getUserNotificationsController,
    getUserController,
    patchNotificationStatusController,
    deleteNotificationController,
    propertyFavoriteController,
    propertyUnfavoriteController,
    getPropertiesFavoritesController,
    deleteUserController,
    updateUserController,
} from "#controllers/users/users.controller.js"
import {
    createUserSearchController,
    getUserSearchesController,
    deleteUserSearchController,
} from "#controllers/users/users_search.controller.js"
import { validateRequest } from "#middlewares/validate_request.js"
import { verifySupabaseToken } from "#middlewares/verifySupabaseToken.js"
import { resolveChatViewer } from "#middlewares/resolveChatViewer.js"
import { chatErrorResponder } from "#controllers/chat/chat_response.js"
import {
    registerPushTokenController,
    unregisterPushTokenController,
} from "#controllers/users/push_tokens.controller.js"
import { EXPO_PUSH_TOKEN_PATTERN } from "#services/chat/chat_push.service.js"
import { CHAT_LOCALES } from "#services/chat/chat_constants.js"
import { createRateLimitStore, sharedRateLimitOptions } from "#config/rateLimit.config.js"

const router = Router()
const handle = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)

// Token registration is normally called once on app launch, on token rotation,
// or after a locale change. This protects the API when a mobile effect/listener
// accidentally re-registers the same token on every render.
const pushTokenRegistrationLimiter = rateLimit({
    ...sharedRateLimitOptions,
    windowMs: 60 * 1000,
    limit: 6,
    keyGenerator: req => req.chatViewer.userId,
    store: createRateLimitStore("push-token-registration"),
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (req, res) => chatResponse(res, 429, "rateLimited"),
})

const ALLOWED_LANGUAGES = ["EN", "MK", "AL", "SQ", "TR"]
const ALLOWED_ROLES = ["CLIENT", "AGENCY", "ADMIN"]
const phone = body("phone")
    .optional()
    .isString()
    .customSanitizer(value => (typeof value === "string" ? value.trim().replace(/\s+/g, " ") : value))
    .custom(value => value === "" || (/^[+\d ()-]{6,20}$/.test(value) && (value.match(/\d/g)?.length || 0) >= 6))
    .withMessage("Invalid phone")

router.get("/", verifySupabaseToken, validateRequest, getUserController)

router.post(
    "/check-user-role",
    [body("email").notEmpty().withMessage("Email is required").isEmail().withMessage("Invalid email")],
    validateRequest,
    checkUserRoleController
)

router.post(
    "/create-user",
    [
        body("fullName")
            .notEmpty()
            .withMessage("User name is required")
            .isString()
            .withMessage("User ID must be a string"),
        body("email").notEmpty().withMessage("User email is required").isEmail().withMessage("Invalid email"),
        body("avatarUrl").isString().optional().isURL().withMessage("Avatar URL must be a valid URL"),
    ],
    validateRequest,
    findOrCreateUserController
)

router.post(
    "/",
    [
        body("email").notEmpty().withMessage("Email is required").isEmail().withMessage("Invalid email"),
        body("password")
            .notEmpty()
            .withMessage("Password is required")
            .isLength({ min: 8 })
            .withMessage("Password must be at least 8 characters long"),
        body("name").notEmpty().withMessage("Name is required").isString().withMessage("Invalid name"),
        body("lastName").optional().isString().withMessage("Invalid last name"),
        body("phone").optional().isNumeric().withMessage("Invalid phone"),
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

router.post(
    "/push-tokens",
    resolveChatViewer,
    pushTokenRegistrationLimiter,
    [
        body("token").isString().matches(EXPO_PUSH_TOKEN_PATTERN),
        body("platform").isIn(["ios", "android"]),
        body("locale").isIn(CHAT_LOCALES),
    ],
    validateRequest,
    handle(registerPushTokenController),
    chatErrorResponder
)

router.delete(
    "/push-tokens/:token",
    resolveChatViewer,
    [param("token").isString().matches(EXPO_PUSH_TOKEN_PATTERN)],
    validateRequest,
    handle(unregisterPushTokenController),
    chatErrorResponder
)

router.patch(
    "/:id",
    [
        body("name").optional().isString().withMessage("Invalid name"),
        body("lastName").optional().isString().withMessage("Invalid last name"),
        phone,
        body("location").optional().isString().withMessage("Invalid location"),
    ],
    resolveChatViewer,
    validateRequest,
    updateUserController,
    chatErrorResponder
)

router.delete("/:id", resolveChatViewer, deleteUserController)

router.get("/:id/notifications", resolveChatViewer, getUserNotificationsController)

router.patch(
    "/:id/notifications/status",
    [body("notificationIds").isArray({ min: 1 }).withMessage("notificationIds must be a non-empty array")],
    resolveChatViewer,
    validateRequest,
    patchNotificationStatusController
)

router.delete("/:id/notifications/:notificationId", resolveChatViewer, deleteNotificationController)

router.post("/:id/favorites/:propertyId", verifySupabaseToken, propertyFavoriteController)

router.delete("/:id/favorites/:propertyId", verifySupabaseToken, propertyUnfavoriteController)

router.get("/:id/favorites", verifySupabaseToken, getPropertiesFavoritesController)

router.post("/:id/searches", verifySupabaseToken, createUserSearchController)

router.get("/:id/searches", verifySupabaseToken, getUserSearchesController)

router.delete("/:id/searches/:searchId", verifySupabaseToken, deleteUserSearchController)

export default router
