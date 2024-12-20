import path from "path"
import fs from "fs"

function readTranslationFile(locale: string): string {
    const filePath = path.join(process.cwd(), "src/messages", `${locale}.json`)
    const fileContents = fs.readFileSync(filePath, "utf8")
    return JSON.parse(fileContents)
}

// Function to get nested property from an object using a string path
function getNestedProperty(obj: string, path: string): string {
    return path.split(".").reduce((current, key) => current && current[key], obj)
}

// Main translation function
export const translation =
    (key: string, variables: Partial<{ [key: string]: string }> = {}) =>
    (locale: string): string => {
        const translations = readTranslationFile(locale)
        let message = getNestedProperty(translations, key)

        if (!message) return key // Return the key if translation is not found

        // Replace variables in the message
        for (const [varKey, varValue] of Object.entries(variables as any)) {
            const placeholder = `{${varKey}}`
            if (typeof varValue === "string") message = message.replace(placeholder, varValue)
        }

        return message
    }
