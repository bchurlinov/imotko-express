import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { parseBulkEmailRequest, renderBulkEmailHtml, sanitizeBulkEmailMessage } from "./bulk_email_request.js"

const CAMPAIGN_ID = "3f1c9a52-7d4e-4b8a-9c21-5e6f7a8b9c0d"
const body = (overrides = {}) => ({
    campaignId: CAMPAIGN_ID,
    subject: "  Новост  ",
    fromEmail: "Contact@Imotko.mk",
    message: "<p>Здраво</p>",
    recipientMode: "agencies",
    recipients: ["A@x.mk", " a@x.mk ", "b@x.mk", ""],
    deliveryMode: "real",
    ...overrides,
})

describe("parseBulkEmailRequest", () => {
    it("normalizes a valid request and de-duplicates recipients case-insensitively", () => {
        assert.deepEqual(parseBulkEmailRequest(body()), {
            ok: true,
            request: {
                campaignId: CAMPAIGN_ID,
                subject: "Новост",
                replyTo: "contact@imotko.mk",
                message: "<p>Здраво</p>",
                recipientMode: "agencies",
                recipients: ["a@x.mk", "b@x.mk"],
                deliveryMode: "real",
            },
        })
    })

    it("treats anything but an explicit 'real' as a redirected (test) campaign", () => {
        assert.equal(parseBulkEmailRequest(body({ deliveryMode: undefined })).request.deliveryMode, "redirect")
        assert.equal(parseBulkEmailRequest(body({ deliveryMode: "REAL" })).request.deliveryMode, "redirect")
    })

    it("rejects a campaign id that is not a UUID", () => {
        assert.deepEqual(parseBulkEmailRequest(body({ campaignId: "abc" })), {
            ok: false,
            message: "A valid campaign id is required.",
        })
    })

    for (const [field, value, message] of [
        ["subject", " ", "Subject is required."],
        ["fromEmail", "nope", "A valid from email is required."],
        ["message", "", "Message is required."],
        ["recipients", [], "At least one recipient is required."],
        ["recipients", "a@x.mk", "At least one recipient is required."],
    ]) {
        it(`rejects ${field}=${JSON.stringify(value)}`, () => {
            assert.equal(parseBulkEmailRequest(body({ [field]: value })).message, message)
        })
    }

    it("lists invalid recipient addresses", () => {
        assert.deepEqual(parseBulkEmailRequest(body({ recipients: ["ok@x.mk", "bad", "also bad@x"] })), {
            ok: false,
            message: "One or more recipient emails are invalid.",
            invalidEmails: ["bad", "also bad@x"],
        })
    })
})

describe("sanitizeBulkEmailMessage", () => {
    // Same output as the web action: DOMPurify drops target/rel there too, so links keep only href
    it("keeps the formatting the admin editor produces and drops scripts and handlers", () => {
        const html = sanitizeBulkEmailMessage(
            '<p onclick="x()"><strong>Hi</strong> <a href="https://imotko.mk" target="_blank" rel="noopener">link</a></p><script>alert(1)</script><img src="x">'
        )
        assert.equal(html, '<p><strong>Hi</strong> <a href="https://imotko.mk">link</a></p>')
    })

    it("drops javascript: links", () => {
        assert.ok(!sanitizeBulkEmailMessage('<a href="javascript:alert(1)">x</a>').includes("javascript"))
    })
})

describe("renderBulkEmailHtml", () => {
    it("renders the escaped title and the already-sanitized body into the admin template", () => {
        const html = renderBulkEmailHtml({ title: "<b>Новост</b>", content: "<p>Здраво</p>" })
        assert.ok(html.includes("&lt;b&gt;Новост&lt;/b&gt;"))
        assert.ok(html.includes("<p>Здраво</p>"))
        assert.ok(html.includes("Тимот на Имотко"))
    })
})
