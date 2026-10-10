// COPIED FROM imotko/src/lib/ai/property_prefill/normalize.js by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).
import { normalizeCharacters } from "../../property_rules/strings.js"

export const MAX_EVIDENCE_LENGTH = 200

const ENTITIES = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" }

// Pasted listings often come from other portals as HTML; the LLM and every length check see plain text only.
export const toPlainText = value => {
    if (typeof value !== "string") return ""
    return value
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p\s*>\s*<p[^>]*>/gi, "\n\n")
        .replace(/<[^>]*>/g, "")
        .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g, entity => ENTITIES[entity])
        .replace(/[ \t]+/g, " ")
        .replace(/ *\n */g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
}

// Same folding for the input and every evidence quote: NFKC, lowercase, Cyrillic/Albanian → Latin, no punctuation.
export const normalizeText = (value = "") =>
    normalizeCharacters(String(value).normalize("NFKC"))
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim()

export const isEvidenceInText = (evidence, paddedNormalizedText) => {
    if (typeof evidence !== "string" || evidence.length === 0 || evidence.length > MAX_EVIDENCE_LENGTH) return false
    const normalizedEvidence = normalizeText(evidence)
    if (normalizedEvidence.length < 2) return false
    return paddedNormalizedText.includes(` ${normalizedEvidence} `)
}

const WORD_NUMBERS = {
    eden: 1,
    edno: 1,
    edna: 1,
    prv: 1,
    prvi: 1,
    vtor: 2,
    dva: 2,
    dve: 2,
    tri: 3,
    tret: 3,
    chetiri: 4,
    pet: 5,
    shest: 6,
    sedum: 7,
    osum: 8,
    devet: 9,
    deset: 10,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    nje: 1,
    dy: 2,
    tre: 3,
    kater: 4,
    pese: 5,
    gjashte: 6,
    garsonjera: 1,
    garsoniera: 1,
    studio: 1,
    prizemje: 0,
    pritlic: 0,
    ground: 0,
    suteren: -1,
    basement: -1,
}

const ROOM_PREFIXES = [
    ["chetvoro", 4],
    ["chetiri", 4],
    ["edno", 1],
    ["dvo", 2],
    ["tro", 3],
    ["tri", 3],
    ["pet", 5],
]

const roomWordNumber = token => {
    if (!/sob(en|na|ni|no)/.test(token)) return undefined
    const match = ROOM_PREFIXES.find(([prefix]) => token.startsWith(prefix))
    return match?.[1]
}

const DIGIT_PATTERN = /\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?/g
const THOUSANDS_SUFFIX = /^\s*(?:k\b|к\b|илј|ilj|hiljad|mij)/i

const toNumber = raw => {
    if (/^\d{1,3}(?:[.,\s]\d{3})+$/.test(raw)) return Number(raw.replace(/[.,\s]/g, ""))
    if (/^\d{1,3}(?:[.,\s]\d{3})+[.,]\d+$/.test(raw)) {
        const lastSeparator = Math.max(raw.lastIndexOf(","), raw.lastIndexOf("."))
        return Number(`${raw.slice(0, lastSeparator).replace(/[.,\s]/g, "")}.${raw.slice(lastSeparator + 1)}`)
    }
    return Number(raw.replace(",", "."))
}

export const parseEvidenceNumbers = (evidence = "") => {
    const text = String(evidence)
    const numbers = []

    for (const match of text.matchAll(DIGIT_PATTERN)) {
        let value = toNumber(match[0].trim())
        if (!Number.isFinite(value)) continue
        if (THOUSANDS_SUFFIX.test(text.slice(match.index + match[0].length))) value *= 1000
        const before = text.slice(Math.max(0, match.index - 2), match.index)
        if (/(^|[^\d])-$/.test(before) || (match.index === 1 && text[0] === "-")) numbers.push(-value)
        numbers.push(value)
    }

    for (const token of normalizeText(text).split(" ")) {
        if (token in WORD_NUMBERS) numbers.push(WORD_NUMBERS[token])
        const rooms = roomWordNumber(token)
        if (rooms !== undefined) numbers.push(rooms)
    }

    return numbers
}

export const isNumberGrounded = (value, evidence) =>
    typeof value === "number" &&
    Number.isFinite(value) &&
    parseEvidenceNumbers(evidence).some(candidate => Math.abs(candidate - value) < 0.01)

export const isValueInEvidence = (value, evidence) => {
    const normalizedValue = normalizeText(value)
    return normalizedValue.length > 0 && ` ${normalizeText(evidence)} `.includes(` ${normalizedValue} `)
}
