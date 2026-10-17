// COPIED FROM imotko/src/lib/client_listings/seller_name.js by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).

const words = value =>
    String(value ?? "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)

// Session sync names an account "User" when the sign-in provider gave no name at all.
const PLACEHOLDER_NAME = "user"

const isPlaceholder = value =>
    String(value ?? "")
        .trim()
        .toLowerCase() === PLACEHOLDER_NAME

// Public pages show only the first name of a private seller (design B §6.3).
export const firstNameOf = name => (isPlaceholder(name) ? null : (words(name)[0] ?? null))

// Buyer ↔ seller threads: "Марко П." on both sides (decision 94a).
export const shortDisplayName = ({ name, lastName } = {}) => {
    const nameWords = words(isPlaceholder(name) ? "" : name)
    const first = nameWords[0]
    if (!first) return null
    const last = words(lastName)[0] ?? (nameWords.length > 1 ? nameWords.at(-1) : null)
    return last ? `${first} ${last[0]}.` : first
}

export const getEmailLocalPart = email =>
    String(email ?? "")
        .split("@")[0]
        .trim()

// Owners register with an email only, so the account name is "" until the wizard asks for it; accounts made by
// session sync carry the email's local part or "User" instead. None of those is a name to show people.
export const isNameMissing = ({ name, lastName, email } = {}) => {
    const value = String(name ?? "").trim()
    if (!value || isPlaceholder(value)) return true
    // A last name only exists when somebody typed a real name.
    if (String(lastName ?? "").trim()) return false
    const localPart = getEmailLocalPart(email)
    return Boolean(localPart) && value.toLowerCase() === localPart.toLowerCase()
}

// Full name for agency threads and emails; the email's local part stands in until the owner gives a name. Only an empty
// or placeholder name falls back: a real first name that matches the start of the email is shown as saved (the review
// prompt in isNameMissing is stricter because asking once more costs nothing).
export const getDisplayName = ({ name, lastName, email } = {}) => {
    if (!String(name ?? "").trim() || isPlaceholder(name)) return getEmailLocalPart(email)
    return [name, lastName].filter(Boolean).join(" ").trim()
}
