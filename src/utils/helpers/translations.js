import path from "path"
import fs from "fs"

/**
 * @typedef {Record<string, unknown>} TranslationMap
 */

/**
 * Read translation file for a given locale
 * @param {string} locale - The locale code (e.g., 'en', 'es')
 * @returns {TranslationMap} The translation map
 */
function readTranslationFile(locale) {
    const filePath = path.join(process.cwd(), "src/messages", `${locale}.json`)
    const fileContents = fs.readFileSync(filePath, "utf8")
    return JSON.parse(fileContents)
}

/**
 * Get nested property from an object using a string path
 * @param {TranslationMap} obj - The translation object
 * @param {string} targetPath - The path to the property (e.g., 'auth.login.title')
 * @returns {string | undefined} The translated string or undefined
 */
function getNestedProperty(obj, targetPath) {
    return targetPath.split(".").reduce((current, key) => {
        if (current && typeof current === "object" && key in current) {
            return current[key]
        }
        return undefined
    }, obj)
}

/**
 * Main translation function
 * @param {string} key - The translation key
 * @param {Partial<Record<string, string>>} [variables={}] - Variables to replace in the message
 * @returns {(locale: string) => string} A function that takes a locale and returns the translated string
 */
export const translation =
    (key, variables = {}) =>
    (locale) => {
        const translations = readTranslationFile(locale)
        let message = getNestedProperty(translations, key)

        if (!message) return key // Return the key if translation is not found

        // Replace variables in the message
        for (const [varKey, varValue] of Object.entries(variables)) {
            const placeholder = `{${varKey}}`
            if (typeof varValue === "string") message = message.replace(placeholder, varValue)
        }

        return message
    }
