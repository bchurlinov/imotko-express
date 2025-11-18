import path from "path";
import fs from "fs";
function readTranslationFile(locale) {
    const filePath = path.join(process.cwd(), "src/messages", `${locale}.json`);
    const fileContents = fs.readFileSync(filePath, "utf8");
    return JSON.parse(fileContents);
}
// Function to get nested property from an object using a string path
function getNestedProperty(obj, targetPath) {
    return targetPath.split(".").reduce((current, key) => {
        if (current && typeof current === "object" && key in current) {
            return current[key];
        }
        return undefined;
    }, obj);
}
// Main translation function
export const translation = (key, variables = {}) => (locale) => {
    const translations = readTranslationFile(locale);
    let message = getNestedProperty(translations, key);
    if (!message)
        return key; // Return the key if translation is not found
    // Replace variables in the message
    for (const [varKey, varValue] of Object.entries(variables)) {
        const placeholder = `{${varKey}}`;
        if (typeof varValue === "string")
            message = message.replace(placeholder, varValue);
    }
    return message;
};
