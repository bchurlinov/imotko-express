import assert from "node:assert/strict"
import test from "node:test"
import { CHAT_ERRORS } from "./chat_constants.js"
import { sanitizeMessage } from "./chat_sanitizer.js"

test("chat sanitizer keeps permitted formatting and safe links", () => {
    const result = sanitizeMessage('<p>Hello <strong>there</strong> <a href="https://imotko.mk">link</a></p>')
    assert.equal(result.bodyText, "Hello there link")
    assert.match(result.bodyHtml, /<strong>there<\/strong>/)
    assert.match(result.bodyHtml, /href="https:\/\/imotko\.mk"/)
    assert.match(result.bodyHtml, /rel="nofollow ugc noopener"/)
    assert.match(result.bodyHtml, /target="_blank"/)
})

test("chat sanitizer removes executable HTML and rejects empty content", () => {
    const result = sanitizeMessage('<script>alert(1)</script><p onclick="x()"></p>')
    assert.equal(result.error, CHAT_ERRORS.MESSAGE_EMPTY)
    assert.doesNotMatch(result.bodyHtml || "", /script|onclick/i)
})

test("chat sanitizer removes unsafe URLs and honors the text limit", () => {
    const unsafe = sanitizeMessage('<a href="javascript:alert(1)">unsafe</a>')
    assert.doesNotMatch(unsafe.bodyHtml, /javascript:/i)
    assert.equal(sanitizeMessage("x".repeat(4000)).bodyText.length, 4000)
    assert.equal(sanitizeMessage("x".repeat(4001)).error, CHAT_ERRORS.MESSAGE_TOO_LONG)
})

test("chat sanitizer keeps mobile-supported aliases and telephone links", () => {
    const result = sanitizeMessage('<p><b>Call</b> <i>us</i> <a href="tel:+38970123456">now</a></p>')
    assert.match(result.bodyHtml, /<b>Call<\/b>/)
    assert.match(result.bodyHtml, /<i>us<\/i>/)
    assert.match(result.bodyHtml, /href="tel:\+38970123456"/)
})
