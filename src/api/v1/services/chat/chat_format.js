export const pickLocalized = (value, locale) => {
    if (!value) return ""
    if (typeof value === "string") return value
    return value[locale] ?? value.mk ?? value.en ?? ""
}

export const fullName = person => [person?.name, person?.lastName].filter(Boolean).join(" ").trim()

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }

export const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => HTML_ESCAPES[character])

export const isoOrNull = value => (value ? new Date(value).toISOString() : null)
