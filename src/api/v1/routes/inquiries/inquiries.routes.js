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
            .withMessage("Невалиден тип на помош.")
            .customSanitizer(normalizeSingleLine)
            .notEmpty()
            .withMessage("Тип на помош е задолжителна."),
        body("category")
            .isString()
            .withMessage("Невалидна категорија.")
            .customSanitizer(normalizeSingleLine)
            .notEmpty()
            .withMessage("Категорија е задолжителна."),
        body("price")
            .customSanitizer(normalizePrice)
            .custom(value => Number.isFinite(value))
            .withMessage("Невалидна цена."),
        body("size")
            .isNumeric()
            .withMessage("Невалидна големина.")
            .customSanitizer(normalizeSingleLine)
            .notEmpty()
            .withMessage("Големина е задолжителна."),
        body("location")
            .isString()
            .withMessage("Невалидна локација.")
            .customSanitizer(normalizeSingleLine)
            .notEmpty()
            .withMessage("Локација е задолжителна."),
        body("name")
            .isString()
            .withMessage("Невалидно име")
            .customSanitizer(normalizeSingleLine)
            .notEmpty()
            .withMessage("Име е задолжително"),
        body("email")
            .customSanitizer(value => (value ? String(value).trim() : ""))
            .custom(value => {
                if (value === "") return true
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
            })
            .withMessage("Невалидна е-пошта."),
        body("phone")
            .isString()
            .withMessage("Невалиден телефонски број.")
            .customSanitizer(normalizeSingleLine)
            .notEmpty()
            .withMessage("Телефон е задолжително")
            .matches(phoneRegex)
            .withMessage("Невалиден формат на телефонски број."),
        body("message")
            .isString()
            .withMessage("Невалидна порака.")
            .customSanitizer(normalizeMultiline)
            .notEmpty()
            .withMessage("Порака е задолжително."),
    ],
    inquiryRateLimit,
    validateRequest,
    postContactRequestController
)

export default router
