import multer from "multer"
import * as yup from "yup"
import { ChatError } from "#services/chat/chat_error.js"
import { ClientListingError } from "#shared/property_rules/client_listing_error.js"
import { formattedErrors } from "#shared/property_rules/error_formatter.js"

export const clientJson = (res, status, message = null, data = undefined) =>
    res.status(status).json({ data: data ?? null, code: status, message })

export const clientListingErrorResponder = (error, req, res, next) => {
    if (res.headersSent) return next(error)
    if (error instanceof ClientListingError || error instanceof ChatError)
        return clientJson(res, error.status, error.code, error.data)
    if (error instanceof yup.ValidationError)
        return clientJson(res, 400, "validationFailed", formattedErrors(error.inner))
    if (error instanceof multer.MulterError) return clientJson(res, 400, "validationFailed")
    if (error?.status === 400 || error?.statusCode === 400) return clientJson(res, 400, "validationFailed")
    console.error("[client-listings] unexpected error", {
        method: req.method,
        path: req.originalUrl,
        error: error instanceof Error ? error.message : String(error),
    })
    return clientJson(res, 500, "somethingWentWrong")
}
