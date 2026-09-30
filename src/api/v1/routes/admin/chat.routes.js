import { Router } from "express"
import { body, param, query } from "express-validator"
import { validateRequest } from "#middlewares/validate_request.js"
import { requireChatAdmin, resolveChatViewer } from "#middlewares/resolveChatViewer.js"
import { chatErrorResponder } from "#controllers/chat/chat_response.js"
import { CHAT_LOCALES } from "#services/chat/chat_constants.js"
import {
    adminConversationController,
    adminConversationsController,
    approveMessageController,
    closeConversationController,
    messagingFlagController,
    pendingMessagesController,
    rejectMessageController,
    reportsController,
    resolveReportController,
} from "#controllers/chat/chat_admin.controller.js"

const router = Router()
const handle = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
const id = name => param(name).isString().trim().notEmpty().isLength({ max: 200 })
const page = query("page").optional().isInt({ min: 1 })
const isoDate = name =>
    query(name)
        .optional()
        .isISO8601({ strict: true })
        .custom(value => {
            if (Number.isNaN(new Date(value).getTime())) throw new Error("Invalid date")
            return true
        })

router.use(resolveChatViewer, requireChatAdmin)
router.get("/messages/pending", [page], validateRequest, handle(pendingMessagesController))
router.get(
    "/conversations",
    [
        page,
        query("agencyId").optional().isString().trim().isLength({ max: 200 }),
        query("email").optional().isString().trim().isLength({ max: 320 }),
        isoDate("from"),
        isoDate("to"),
    ],
    validateRequest,
    (req, res, next) => {
        if (req.query.from && req.query.to && new Date(req.query.from) > new Date(req.query.to))
            return res.status(400).json({ data: undefined, code: 400, message: "validationFailed" })
        next()
    },
    handle(adminConversationsController)
)
router.get(
    "/conversations/:id",
    [id("id"), query("locale").optional().isIn(CHAT_LOCALES)],
    validateRequest,
    handle(adminConversationController)
)
router.get("/reports", [page], validateRequest, handle(reportsController))
router.patch("/messages/:id/approve", [id("id")], validateRequest, handle(approveMessageController))
router.patch("/messages/:id/reject", [id("id")], validateRequest, handle(rejectMessageController))
router.patch("/conversations/:id/close", [id("id")], validateRequest, handle(closeConversationController))
router.patch("/reports/:id/resolve", [id("id")], validateRequest, handle(resolveReportController))
router.patch(
    "/users/:id/messaging-flag",
    [id("id"), body("flagged").isBoolean()],
    validateRequest,
    handle(messagingFlagController)
)
router.use(chatErrorResponder)

export default router
