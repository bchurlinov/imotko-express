// COPIED FROM imotko/src/utils/sanitize_server.js by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).
import { JSDOM } from "jsdom"
import DOMPurify from "dompurify"

const window = new JSDOM("").window
const DOMPurifyServer = DOMPurify(window)

export const sanitizeServer = (html, config = {}) => {
    const defaultConfig = {
        ALLOWED_TAGS: ["p", "b", "i", "strong", "em", "a", "br", "ul", "ol", "li"],
        // SECURITY(F-30): the old keys (ALLOWED_ATTRS / ALLOWED_URI_ATTRS / URI_SAFE_FUNCTIONS) are not DOMPurify options
        // and were silently ignored. These are the real names: only href is kept, and only http(s)/mailto/tel URLs.
        ALLOWED_ATTR: ["href"],
        ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:)/i,
    }
    const mergedConfig = { ...defaultConfig, ...config }
    return DOMPurifyServer.sanitize(html, mergedConfig)
}
