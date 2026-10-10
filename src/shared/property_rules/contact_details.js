// COPIED FROM imotko/src/lib/property/contact_details.js by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).

// Private sellers are reached only through Imotko chat, so client listings must not carry a phone number, an email, a
// link or a social/messenger profile in their title or description (design B §3, private listing AI cleanup §3.1).
// Agencies are not checked.

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
// "01.06.2025", "05/09/26": dates start with 0 too.
const DATE_LIKE = /^\d{1,2}[./-]\d{1,2}[./-](?:\d{4}|\d{2})$/

const isPhoneLike = candidate => {
    const trimmed = candidate.trim()
    if (DATE_LIKE.test(trimmed)) return false
    const digits = trimmed.replace(/\D/g, "")
    return digits.length >= MIN_PHONE_DIGITS && digits.length <= MAX_PHONE_DIGITS
}

const hasPhone = text => [...text.matchAll(PHONE_CANDIDATE)].some(([candidate]) => isPhoneLike(candidate))

const AT_WORDS = /\s*(?:\(at\)|\[at\]|\bat\b(?=\s+[a-z0-9-]+\s*(?:\.|\(dot\)|\[dot\]|\bdot\b|точка))|мајмунче)\s*/gi
// \b only knows ASCII word characters, so "точка" needs explicit letter lookarounds.
const DOT_WORDS = /\s*(?:\(dot\)|\[dot\]|(?<![\p{L}\d])(?:dot|точка)(?![\p{L}\d]))\s*/giu
const EMAIL = /[a-z0-9._%+-]+\s*@\s*[a-z0-9-]+(?:\s*\.\s*[a-z0-9-]+)*\s*\.\s*[a-z]{2,}/i

const hasEmail = text => EMAIL.test(text.replace(AT_WORDS, "@").replace(DOT_WORDS, "."))

// Raw-text forms of the email rule, for removal: literal and spelled-out "@" / ".".
const EMAIL_LOOSE =
    /[a-z0-9._%+-]+\s*(?:@|\(at\)|\[at\]|мајмунче)\s*[a-z0-9-]+(?:\s*(?:\.|\(dot\)|\[dot\]|точка)\s*[a-z0-9-]+)+/giu
const EMAIL_WORDS = /[a-z0-9._%+-]+\s+at\s+[a-z0-9-]+(?:\s+dot\s+[a-z0-9-]+)+/gi

const URL_TLDS = "mk|com|net|org|info|eu|al|rs|me|io|co|app|site|online"
const URL_PATTERN = new RegExp(
    `(?:https?:\\/\\/|www\\.)[^\\s<>"]+|(?<![\\w@.-])[a-z0-9-]+(?:\\.[a-z0-9-]+)*\\.(?:${URL_TLDS})\\b(?:\\/[^\\s<>"]*)?`,
    "gi"
)

const HANDLE_PATTERN = /(?<![\p{L}\p{N}_.@-])@[a-z0-9_.]{3,30}/giu
const MESSENGER_WORDS =
    "viber|whats\\s?app|wa|instagram|insta|ig|facebook|fb|telegram|tiktok|" +
    "вибер|вајбер|инстаграм|инста|фејсбук|фб|телеграм|тикток|вотсап|вацап"
// A messenger word counts only when a handle follows: after ":" / "-", or a token with a digit, "_" or ".".
const MESSENGER_PATTERN = new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${MESSENGER_WORDS})(?![\\p{L}\\p{N}])` +
        `(?:\\s*[:\\-–]\\s*@?[a-z0-9_.]{3,30}|\\s+@?[a-z0-9]*[_.\\d][a-z0-9_.]*)`,
    "giu"
)

// String#search ignores the g flag's lastIndex, so the shared global patterns stay safe to reuse.
const matches = (pattern, text) => text.search(pattern) !== -1

export const findContactDetails = value => {
    const text = toPlainText(value)
    return {
        phone: hasPhone(text),
        email: hasEmail(text),
        url: matches(URL_PATTERN, text),
        handle: matches(HANDLE_PATTERN, text) || matches(MESSENGER_PATTERN, text),
    }
}

export const hasContactDetails = value => Object.values(findContactDetails(value)).some(Boolean)

const fieldHasContact = (body, fields) => fields.some(field => hasContactDetails(body?.[field]))

export const findContactDetailsField = body => {
    if (fieldHasContact(body, TITLE_FIELDS)) return "name"
    if (fieldHasContact(body, DESCRIPTION_FIELDS)) return "description"
    return null
}

const REMOVALS = [EMAIL_LOOSE, EMAIL_WORDS, URL_PATTERN, HANDLE_PATTERN, MESSENGER_PATTERN]

const tidy = (text, format) => {
    const spaced = text.replace(/[ \t]{2,}/g, " ").replace(/ +([,.;:!?])/g, "$1")
    if (format === "html") {
        return spaced
            .replace(/<p>\s*<\/p>/gi, "")
            .replace(/<p>\s+/gi, "<p>")
            .replace(/\s+<\/p>/gi, "</p>")
            .trim()
    }
    return spaced
        .split("\n")
        .map(line => line.trim())
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
}

// Safety net after the AI step and the fallback when it fails. Never used for agencies.
export const stripContactDetails = (text, { format = "plain" } = {}) => {
    if (text == null) return ""
    let next = format === "html" ? String(text).replace(/&nbsp;/gi, " ") : String(text)
    for (const pattern of REMOVALS) next = next.replace(pattern, "")
    next = next.replace(PHONE_CANDIDATE, candidate => (isPhoneLike(candidate) ? "" : candidate))
    return tidy(next, format)
}
