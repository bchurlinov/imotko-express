import { Router } from "express"
import { getPropertiesController, getPropertyByIdController } from "#controllers/properties/properties.controller.js"
import { reportPropertyController } from "#controllers/properties/property_report.controller.js"
import { chatErrorResponder } from "#controllers/chat/chat_response.js"
import { body, query, param } from "express-validator"
import { validateRequest } from "#middlewares/validate_request.js"
import { attachOptionalViewer } from "#middlewares/optional_viewer.js"
import { resolveChatViewer } from "#middlewares/resolveChatViewer.js"
import { propertyReportRateLimit } from "#middlewares/propertyReportRateLimit.js"
import {
    PROPERTY_REPORT_MESSAGE_MAX_LENGTH,
    PROPERTY_REPORT_REASONS,
} from "#services/properties/property_report.service.js"

const router = Router()
const handle = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)

router.get("/", getPropertiesController)

router.get(
    "/:id",
    [param("id").notEmpty().withMessage("Property ID is required").trim()],
    validateRequest,
    attachOptionalViewer,
    getPropertyByIdController
)

// Report a listing to the moderation team (App Store guideline 1.2). Signed-in users only. The error responder sits on
// this route alone so the public GET routes keep their own error handling.
router.post(
    "/:id/report",
    [
        param("id").isString().trim().notEmpty().isLength({ max: 200 }),
        body("reason").isIn(Object.keys(PROPERTY_REPORT_REASONS)),
        body("message").optional({ nullable: true }).isString().isLength({ max: PROPERTY_REPORT_MESSAGE_MAX_LENGTH }),
    ],
    validateRequest,
    propertyReportRateLimit,
    resolveChatViewer,
    handle(reportPropertyController),
    chatErrorResponder
)

export default router
