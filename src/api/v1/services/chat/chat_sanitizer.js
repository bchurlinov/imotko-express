import sanitizeHtml from "sanitize-html"
import { convert } from "html-to-text"
import { CHAT_ERRORS, CHAT_LIMITS } from "./chat_constants.js"

const ALLOWED_TAGS = ["p", "br", "strong", "b", "em", "i", "ul", "ol", "li", "a"]
const LINK_ATTRIBUTES = { rel: "nofollow ugc noopener", target: "_blank" }

export const sanitizeMessage = rawHtml => {
    const input = String(rawHtml ?? "")
    if (input.length > CHAT_LIMITS.MESSAGE_MAX_RAW_LENGTH) return { error: CHAT_ERRORS.MESSAGE_TOO_LONG }

    const bodyHtml = sanitizeHtml(input, {
        allowedTags: ALLOWED_TAGS,
        allowedAttributes: { a: ["href", "rel", "target"] },
        allowedSchemes: ["http", "https", "mailto", "tel"],
        allowedSchemesByTag: { a: ["http", "https", "mailto", "tel"] },
        allowProtocolRelative: false,
        parseStyleAttributes: false,
        transformTags: {
            a: (tagName, attribs) => ({
                tagName,
                attribs: attribs.href ? { href: attribs.href, ...LINK_ATTRIBUTES } : {},
            }),
        },
    }).trim()

    const bodyText = convert(bodyHtml, {
        wordwrap: false,
        selectors: [
            { selector: "a", options: { ignoreHref: true } },
            { selector: "p", options: { leadingLineBreaks: 0, trailingLineBreaks: 1 } },
        ],
    })
        .replace(/\n{3,}/g, "\n\n")
        .trim()

    if (!bodyText) return { error: CHAT_ERRORS.MESSAGE_EMPTY }
    if (bodyText.length > CHAT_LIMITS.MESSAGE_MAX_TEXT_LENGTH) return { error: CHAT_ERRORS.MESSAGE_TOO_LONG }
    return { bodyHtml, bodyText }
}
