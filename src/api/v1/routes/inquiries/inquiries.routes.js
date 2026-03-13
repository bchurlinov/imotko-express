import { Router } from "express"
import { body } from "express-validator"
import { validateRequest } from "#middlewares/validate_request.js"
import { inquiryRateLimit } from "#middlewares/inquiryRateLimit.js"
import { postContactRequestController } from "#controllers/inquiries/inquiries.controller.js"

const router = Router()

const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s]?[(]?[0-9]{1,4}[)]?[-\s]?[0-9]{1,9}$/
const normalizeSingleLine = value => String(value).trim().replace(/\s+/g, " ")
const normalizeMultiline = value => String(value).trim().replace(/\r\n/g, "\n")

const normalizePrice = value => {
    if (typeof value === "number") return value
    if (typeof value === "string") {
        const trimmedValue = value.trim()
        if (!trimmedValue) return Number.NaN

        return Number(trimmedValue)
    }

    return Number.NaN
}

router.post(
    "/contact-request",
    [
        body("helpType")
            .isString()
            .withMessage("helpType must be a string")
            .customSanitizer(normalizeSingleLine)
            .notEmpty()
            .withMessage("helpType is required"),
        body("category")
            .isString()
            .withMessage("category must be a string")
            .customSanitizer(normalizeSingleLine)
            .notEmpty()
            .withMessage("category is required"),
        body("price")
            .custom(value => Number.isFinite(normalizePrice(value)))
            .withMessage("price must be a valid number")
            .customSanitizer(normalizePrice),
        body("location")
            .isString()
            .withMessage("location must be a string")
            .customSanitizer(normalizeSingleLine)
            .notEmpty()
            .withMessage("location is required"),
        body("name")
            .isString()
            .withMessage("name must be a string")
            .customSanitizer(normalizeSingleLine)
            .notEmpty()
            .withMessage("name is required"),
        body("email")
            .customSanitizer(value => String(value).trim())
            .notEmpty()
            .withMessage("email is required")
            .isEmail()
            .withMessage("email must be valid"),
        body("phone")
            .isString()
            .withMessage("phone must be a string")
            .customSanitizer(normalizeSingleLine)
            .notEmpty()
            .withMessage("phone is required")
            .matches(phoneRegex)
            .withMessage("Invalid phone number format"),
        body("message")
            .isString()
            .withMessage("message must be a string")
            .customSanitizer(normalizeMultiline)
            .notEmpty()
            .withMessage("message is required"),
    ],
    inquiryRateLimit,
    validateRequest,
    postContactRequestController
)

export default router
