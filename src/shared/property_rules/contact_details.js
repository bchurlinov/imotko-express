// COPIED FROM imotko/src/lib/property/contact_details.js by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).

// Private sellers are reached only through Imotko chat, so client listings must not carry a phone number or an email
// in their title or description (design B §3). Agencies are not checked.

const TITLE_FIELDS = ["name", "nameMk", "nameEn", "nameSq", "nameTr"]
const DESCRIPTION_FIELDS = ["description", "descriptionMk", "descriptionEn", "descriptionSq", "descriptionTr"]

const toPlainText = value =>
    String(value ?? "")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")

// A run that starts with "+" or "0" (Macedonian numbers are 0xx / +389 / 00389), not glued to a preceding digit or
// separator (so "1.000.000" never yields a "000.000" candidate), with digits separated by spaces . - / ( ).
const PHONE_CANDIDATE = /(?<![\d.,\-/])(?:\+|\(\+|0)[\d\s.\-/()]{6,}\d/g
const MIN_PHONE_DIGITS = 8
const MAX_PHONE_DIGITS = 15

const hasPhone = text => {
    for (const [candidate] of text.matchAll(PHONE_CANDIDATE)) {
        const digits = candidate.replace(/\D/g, "")
        if (digits.length >= MIN_PHONE_DIGITS && digits.length <= MAX_PHONE_DIGITS) return true
    }
    return false
}

const AT_WORDS = /\s*(?:\(at\)|\[at\]|\bat\b(?=\s+[a-z0-9-]+\s*(?:\.|\(dot\)|\[dot\]|\bdot\b|точка))|мајмунче)\s*/gi
// \b only knows ASCII word characters, so "точка" needs explicit letter lookarounds.
const DOT_WORDS = /\s*(?:\(dot\)|\[dot\]|(?<![\p{L}\d])(?:dot|точка)(?![\p{L}\d]))\s*/giu
const EMAIL = /[a-z0-9._%+-]+\s*@\s*[a-z0-9-]+(?:\s*\.\s*[a-z0-9-]+)*\s*\.\s*[a-z]{2,}/i

const hasEmail = text => EMAIL.test(text.replace(AT_WORDS, "@").replace(DOT_WORDS, "."))

export const findContactDetails = value => {
    const text = toPlainText(value)
    return { phone: hasPhone(text), email: hasEmail(text) }
}

const fieldHasContact = (body, fields) =>
    fields.some(field => {
        const found = findContactDetails(body?.[field])
        return found.phone || found.email
    })

export const findContactDetailsField = body => {
    if (fieldHasContact(body, TITLE_FIELDS)) return "name"
    if (fieldHasContact(body, DESCRIPTION_FIELDS)) return "description"
    return null
}
