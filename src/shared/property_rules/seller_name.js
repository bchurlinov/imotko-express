// COPIED FROM imotko/src/lib/client_listings/seller_name.js by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).

const words = value =>
    String(value ?? "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)

// Public pages show only the first name of a private seller (design B §6.3).
export const firstNameOf = name => words(name)[0] ?? null

// Buyer ↔ seller threads: "Марко П." on both sides (decision 94a).
export const shortDisplayName = ({ name, lastName } = {}) => {
    const nameWords = words(name)
    const first = nameWords[0]
    if (!first) return null
    const last = words(lastName)[0] ?? (nameWords.length > 1 ? nameWords.at(-1) : null)
    return last ? `${first} ${last[0]}.` : first
}
