// COPIED FROM imotko/src/lib/ai/property_prefill/description.js by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).
import { ensureContactInfoPreserved } from "../contact_preservation.js"
import { stripContactDetails } from "../../property_rules/contact_details.js"
import { sanitizeServer } from "../../property_rules/sanitize_server.js"
import { normalizeText } from "./normalize.js"
import { PREFILL_ACTOR } from "./field_sets.js"

export const MIN_DESCRIPTION_RATIO = 0.85
const MIN_DESCRIPTION_LENGTH = 20

const escapeHtml = text => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

export const toParagraphHtml = text =>
    escapeHtml(String(text))
        .split(/\n\s*\n/)
        .map(paragraph => paragraph.trim())
        .filter(Boolean)
        .map(paragraph => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
        .join("")

// Same rules as the post-create enrichment (spec decision 13): the LLM may only transliterate and fix casing. A shorter
// result means it summarized, so the agent's own text is used instead.
export const toPrefillDescription = ({ text, transformed, actorKind }) => {
    const inputLength = normalizeText(text).length
    const keepsLength =
        typeof transformed === "string" && normalizeText(transformed).length >= inputLength * MIN_DESCRIPTION_RATIO
    const chosen = keepsLength ? transformed : text

    // Private sellers are contactable only through Imotko chat (private-listing cleanup spec); agencies keep contacts.
    const body =
        actorKind === PREFILL_ACTOR.CLIENT ? stripContactDetails(chosen) : ensureContactInfoPreserved(text, chosen)
    const html = sanitizeServer(toParagraphHtml(body))

    return normalizeText(html.replace(/<[^>]*>/g, " ")).length >= MIN_DESCRIPTION_LENGTH ? html : null
}
