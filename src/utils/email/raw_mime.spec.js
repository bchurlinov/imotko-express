import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildRawEmail, encodeAddress, encodeHeader } from "./raw_mime.js"

// Same cases as imotko's src/lib/email/raw_mime.test.js
const decodeHeader = value =>
    value
        .split("\r\n ")
        .map(word => Buffer.from(word.match(/^=\?UTF-8\?B\?(.*)\?=$/)[1], "base64").toString("utf8"))
        .join("")

const partBody = (raw, contentTypeLine) => {
    const start = raw.indexOf(contentTypeLine)
    const body = raw.slice(raw.indexOf("\r\n\r\n", start) + 4)
    return body.slice(0, body.indexOf("\r\n--")).replace(/\r\n/g, "")
}

describe("encodeHeader", () => {
    it("leaves ASCII untouched", () => {
        assert.equal(encodeHeader("New message"), "New message")
    })

    it("encodes long Cyrillic text into folded words under 76 characters", () => {
        const subject = "Имате нова порака за огласот Апартман во Беј Бунар, Охрид"
        const encoded = encodeHeader(subject)
        assert.ok(encoded.split("\r\n ").every(word => word.length <= 75))
        assert.equal(decodeHeader(encoded), subject)
    })

    it("strips line breaks so a header cannot be injected", () => {
        assert.equal(encodeHeader("Hi\r\nBcc: x@example.com"), "Hi Bcc: x@example.com")
    })
})

describe("encodeAddress", () => {
    it("quotes an ASCII display name", () => {
        assert.equal(encodeAddress("Imotko <info@imotko.mk>"), '"Imotko" <info@imotko.mk>')
    })

    it("encodes a non ASCII display name", () => {
        assert.equal(encodeAddress("Имотко <info@imotko.mk>"), "=?UTF-8?B?0JjQvNC+0YLQutC+?= <info@imotko.mk>")
    })

    it("passes a bare address through", () => {
        assert.equal(encodeAddress(" user@example.com "), "user@example.com")
    })
})

describe("buildRawEmail", () => {
    const base = {
        from: "Imotko <info@imotko.mk>",
        to: ["a@example.com"],
        subject: "Нова порака",
        html: '<p>Здраво</p><img src="cid:logo-email@imotko.mk">',
    }

    it("puts the HTML and inline images in multipart/related", () => {
        const raw = buildRawEmail({
            ...base,
            replyTo: ["reply@example.com"],
            inlineImages: [
                { cid: "logo-email@imotko.mk", filename: "logo_email.png", contentType: "image/png", content: Buffer.from("png") },
            ],
        })

        assert.ok(raw.includes("To: a@example.com\r\n"))
        assert.ok(raw.includes("Reply-To: reply@example.com\r\n"))
        assert.match(raw, /Content-Type: multipart\/related; boundary="[^"]+"; type="text\/html"/)
        assert.ok(raw.includes('Content-ID: <logo-email@imotko.mk>\r\nContent-Disposition: inline; filename="logo_email.png"'))
        assert.equal(Buffer.from(partBody(raw, "Content-Type: text/html"), "base64").toString("utf8"), base.html)
        assert.equal(partBody(raw, "Content-Type: image/png"), Buffer.from("png").toString("base64"))
    })

    it("sends a single HTML part when there are no images", () => {
        const raw = buildRawEmail(base)
        assert.ok(!raw.includes("multipart/"))
        assert.ok(!raw.includes("Reply-To:"))
    })

    it("keeps every body line within 76 characters", () => {
        const raw = buildRawEmail({ ...base, html: "<p>" + "Имотко ".repeat(500) + "</p>" })
        const body = raw.slice(raw.indexOf("\r\n\r\n") + 4)
        assert.ok(body.split("\r\n").every(line => line.length <= 76))
    })
})
