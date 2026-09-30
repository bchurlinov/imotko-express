import { Router } from "express"
import { body, param, query } from "express-validator"
import { validateRequest } from "#middlewares/validate_request.js"
import { resolveChatViewer, requireChatParticipant } from "#middlewares/resolveChatViewer.js"
import {
    blockConversationController,
    chatContextController,
    getConversationController,
    guestController,
    listConversationsController,
    lookupConversationController,
    readConversationController,
    removeConversationController,
    reportConversationController,
    requestMessagePushController,
    sendMessageController,
    startConversationController,
    unreadController,
} from "#controllers/chat/chat.controller.js"
import { chatErrorResponder } from "#controllers/chat/chat_response.js"
import { CHAT_LIMITS, CHAT_LOCALES } from "#services/chat/chat_constants.js"

const router = Router()
const handle = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
const id = name => param(name).isString().trim().notEmpty().isLength({ max: 200 })
const bodyHtml = body("bodyHtml").isString().isLength({ max: CHAT_LIMITS.MESSAGE_MAX_RAW_LENGTH })
const optionalId = name => body(name).optional({ nullable: true }).isString().trim().notEmpty().isLength({ max: 200 })
const locale = location => location("locale").optional().isIn(CHAT_LOCALES)

router.post(
    "/guest",
    [
        body("name").isString().trim().notEmpty().isLength({ max: 80 }),
        body("email").isString().trim().isEmail().normalizeEmail(),
        body("phone").optional({ nullable: true }).isString().matches(/^\d+$/).isLength({ max: 30 }),
        bodyHtml,
        body("agencyId").isString().trim().notEmpty().isLength({ max: 200 }),
        optionalId("propertyId"),
        locale(body),
        body("verificationChoice").isIn(["verify", "later"]),
        body("company").optional().isString().isLength({ max: 200 }),
    ],
    validateRequest,
    handle(guestController)
)

router.use(resolveChatViewer)

router.get(
    "/conversations",
    [
        query("q").optional().isString().trim().isLength({ max: 100 }),
        locale(query),
        query("limit").optional().isInt({ min: 1, max: 300 }),
    ],
    validateRequest,
    requireChatParticipant,
    handle(listConversationsController)
)
router.post(
    "/conversations",
    [body("agencyId").isString().trim().notEmpty().isLength({ max: 200 }), optionalId("propertyId"), bodyHtml],
    validateRequest,
    requireChatParticipant,
    handle(startConversationController)
)
router.get(
    "/conversations/lookup",
    [
        query("agencyId").isString().trim().notEmpty().isLength({ max: 200 }),
        query("propertyId").optional().isString().trim().notEmpty().isLength({ max: 200 }),
    ],
    validateRequest,
    requireChatParticipant,
    handle(lookupConversationController)
)
router.get(
    "/conversations/:id",
    [id("id"), locale(query)],
    validateRequest,
    requireChatParticipant,
    handle(getConversationController)
)
router.post(
    "/conversations/:id/messages",
    [id("id"), bodyHtml],
    validateRequest,
    requireChatParticipant,
    handle(sendMessageController)
)
router.post(
    "/messages/:messageId/push",
    [id("messageId")],
    validateRequest,
    requireChatParticipant,
    handle(requestMessagePushController)
)
router.patch(
    "/conversations/:id/read",
    [id("id")],
    validateRequest,
    requireChatParticipant,
    handle(readConversationController)
)
router.post(
    "/conversations/:id/block",
    [id("id")],
    validateRequest,
    requireChatParticipant,
    handle(blockConversationController)
)
router.post(
    "/conversations/:id/report",
    [id("id"), body("reason").optional().isString().isLength({ max: CHAT_LIMITS.REPORT_REASON_MAX_LENGTH })],
    validateRequest,
    requireChatParticipant,
    handle(reportConversationController)
)
router.post(
    "/conversations/:id/remove",
    [id("id")],
    validateRequest,
    requireChatParticipant,
    handle(removeConversationController)
)
router.get("/unread", handle(unreadController))
router.get("/context", requireChatParticipant, handle(chatContextController))
router.use(chatErrorResponder)

export default router
