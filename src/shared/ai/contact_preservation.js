// COPIED FROM imotko/src/lib/ai/contact_preservation.js by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).

const PHONE_REGEX = /(\+?\d[\d\s\-()/]{6,}\d)/g
const EMAIL_REGEX = /[\w.+-]+@[\w-]+\.[\w.-]+/g
const URL_REGEX = /\b(?:https?:\/\/|www\.)[^\s]+/gi

const toSearchableText = (text, format) => {
    if (!text) return ""
    return format === "html" ? text.replace(/<[^>]*>/g, " ") : text
}

export const extractContactTokens = text => {
    if (!text) return []
    const matches = [
        ...(text.match(EMAIL_REGEX) || []),
        ...(text.match(URL_REGEX) || []),
        ...(text.match(PHONE_REGEX) || []),
    ]
    return [...new Set(matches.map(token => token.trim()).filter(Boolean))]
}

export const ensureContactInfoPreserved = (originalText, enrichedText, { format = "plain" } = {}) => {
    const searchableEnriched = toSearchableText(enrichedText, format)
    const missingTokens = extractContactTokens(toSearchableText(originalText, format)).filter(
        token => !searchableEnriched.includes(token)
    )

    if (missingTokens.length === 0) return enrichedText
    if (format === "html") return `${enrichedText}<p>${missingTokens.join("<br>")}</p>`
    return `${enrichedText}\n\n${missingTokens.join("\n")}`
}
