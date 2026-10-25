// Port of imotko's src/lib/email/raw_mime.js (raw SES messages with inline images).
import { randomUUID } from "node:crypto"

const CRLF = "\r\n"
const PRINTABLE_ASCII = /^[\x20-\x7e]*$/
// 45 UTF-8 bytes → 60 base64 chars, keeping each encoded word under the 75 char limit (RFC 2047).
const ENCODED_WORD_BYTES = 45

const wrapBase64 = value => value.match(/.{1,76}/g)?.join(CRLF) ?? ""
const toBase64 = content => (Buffer.isBuffer(content) ? content.toString("base64") : content)
const quoteParam = value => String(value).replace(/["\\\r\n]/g, "_")

// Non ASCII header values (Cyrillic subjects, sender names) must be encoded words, raw UTF-8 headers get mangled.
export const encodeHeader = (value = "") => {
    const text = String(value).replace(/[\r\n]+/g, " ")
    if (PRINTABLE_ASCII.test(text)) return text

    const words = []
    let chunk = ""
    for (const char of text) {
        if (Buffer.byteLength(chunk + char, "utf8") > ENCODED_WORD_BYTES) {
            words.push(chunk)
            chunk = ""
        }
        chunk += char
    }
    if (chunk) words.push(chunk)
    return words.map(word => `=?UTF-8?B?${Buffer.from(word, "utf8").toString("base64")}?=`).join(`${CRLF} `)
}

export const encodeAddress = (address = "") => {
    const match = String(address).match(/^\s*(.*?)\s*<([^>]+)>\s*$/)
    if (!match || !match[1]) return String(address).trim()
    const name = match[1].replace(/^"|"$/g, "")
    return `${PRINTABLE_ASCII.test(name) ? `"${quoteParam(name)}"` : encodeHeader(name)} <${match[2]}>`
}

const htmlPart = html =>
    [
        "Content-Type: text/html; charset=UTF-8",
        "Content-Transfer-Encoding: base64",
        "",
        wrapBase64(Buffer.from(html, "utf8").toString("base64")),
    ].join(CRLF)

const filePart = ({ filename, contentType, content, cid }) =>
    [
        `Content-Type: ${contentType}; name="${quoteParam(filename)}"`,
        "Content-Transfer-Encoding: base64",
        ...(cid ? [`Content-ID: <${cid}>`] : []),
        `Content-Disposition: ${cid ? "inline" : "attachment"}; filename="${quoteParam(filename)}"`,
        "",
        wrapBase64(toBase64(content)),
    ].join(CRLF)

const multipart = (subtype, parts, extraParams = "") => {
    const boundary = `----=_Imotko_${subtype}_${randomUUID()}`
    return [
        `Content-Type: multipart/${subtype}; boundary="${boundary}"${extraParams}`,
        "",
        ...parts.map(part => `--${boundary}${CRLF}${part}`),
        `--${boundary}--`,
    ].join(CRLF)
}

// Inline images sit next to the HTML in multipart/related (referenced as cid:), file attachments wrap that in
// multipart/mixed. `content` is a Buffer or a base64 string.
export const buildRawEmail = ({ from, to = [], replyTo = [], subject, html, inlineImages = [], attachments = [] }) => {
    const headers = [
        `From: ${encodeAddress(from)}`,
        `To: ${to.map(encodeAddress).join(", ")}`,
        ...(replyTo.length ? [`Reply-To: ${replyTo.map(encodeAddress).join(", ")}`] : []),
        `Subject: ${encodeHeader(subject)}`,
        "MIME-Version: 1.0",
    ]

    const body = inlineImages.length
        ? multipart("related", [htmlPart(html), ...inlineImages.map(filePart)], '; type="text/html"')
        : htmlPart(html)
    const message = attachments.length
        ? multipart("mixed", [body, ...attachments.map(({ cid, ...attachment }) => filePart(attachment))])
        : body

    return `${headers.join(CRLF)}${CRLF}${message}${CRLF}`
}
