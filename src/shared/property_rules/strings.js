// COPIED FROM imotko/src/utils/formatStringsAndNumbers.js (only: formatPrice, normalizeCharacters, slugifyText) by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).

export const formatPrice = value => {
    if (!value) return ""

    let cleanedValue = value.toString().replace(/[.]/g, "").replace(/,/g, ".")
    let numericValue = parseFloat(cleanedValue)

    if (isNaN(numericValue)) return "Invalid input"

    if (numericValue >= 1_000_000) {
        return (numericValue / 1_000_000).toFixed(2).replace(/\.00$/, "") + "M"
    }

    return new Intl.NumberFormat("de-DE").format(Math.floor(numericValue))
}

export const normalizeCharacters = string => {
    const charMap = {
        // Macedonian specific
        а: "a",
        б: "b",
        в: "v",
        г: "g",
        д: "d",
        ѓ: "gj",
        е: "e",
        ж: "zh",
        з: "z",
        ѕ: "dz",
        и: "i",
        ј: "j",
        к: "k",
        л: "l",
        љ: "lj",
        м: "m",
        н: "n",
        њ: "nj",
        о: "o",
        п: "p",
        р: "r",
        с: "s",
        т: "t",
        ќ: "kj",
        у: "u",
        ф: "f",
        х: "h",
        ц: "c",
        ч: "ch",
        џ: "dj",
        ш: "sh",

        // Albanian specific
        ë: "e",
        ç: "c",
        â: "a",
        ê: "e",
        î: "i",
        ô: "o",
        û: "u",

        // Common diacritics
        à: "a",
        á: "a",
        ä: "a",
        ã: "a",
        ā: "a",
        è: "e",
        é: "e",
        ē: "e",
        ì: "i",
        í: "i",
        ï: "i",
        ī: "i",
        ò: "o",
        ó: "o",
        ö: "o",
        ō: "o",
        õ: "o",
        ù: "u",
        ú: "u",
        ü: "u",
        ū: "u",
        ý: "y",
        ÿ: "y",
        ñ: "n",
        ß: "ss",
    }

    return Array.from(string.toLowerCase())
        .map(char => charMap[char] || char)
        .join("")
}

export const slugifyText = (string, maxLength = 100) => {
    const normalizedString = normalizeCharacters(string)
    const slug = normalizedString
        .trim()
        .replace(/[\s\W-]+/g, "-")
        .replace(/^-+|-+$/g, "")
    return slug.length > maxLength ? slug.substring(0, maxLength).replace(/-+$/, "") : slug
}
