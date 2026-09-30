import { ChatError } from "#services/chat/chat_error.js"
import { CHAT_ERRORS } from "#services/chat/chat_constants.js"

export const chatResponse = (res, status = 200, message = null, data = undefined, errors = undefined) =>
    res.status(status).json({ data: data ?? null, code: status, message, ...(errors?.length ? { errors } : {}) })

const validationErrors = error =>
    Array.isArray(error?.errors)
        ? error.errors.map(item => ({ field: item.path || item.param || "request", code: "invalidFormat" }))
        : undefined

export const chatErrorResponder = (error, req, res, next) => {
    if (res.headersSent) return next(error)
    if (error instanceof ChatError) return chatResponse(res, error.status, error.code, error.data)
    if (error?.status === 400 || error?.statusCode === 400)
        return chatResponse(res, 400, CHAT_ERRORS.VALIDATION_FAILED, null, validationErrors(error))

    console.error("[chat] unexpected error", {
        method: req.method,
        path: req.originalUrl,
        error: error instanceof Error ? error.message : String(error),
    })
    return chatResponse(res, 500, CHAT_ERRORS.SOMETHING_WENT_WRONG)
}
