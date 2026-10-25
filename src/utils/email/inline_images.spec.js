import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { inlineHostedImages } from "./inline_images.js"

describe("inlineHostedImages", () => {
    it("swaps the hosted logo and store icons for cid references and returns the image parts", () => {
        const html =
            '<img src="https://imotko.mk/icons/logo_email.png"><img src="https://imotko.mk/icons/logo_email.png">' +
            '<img src="https://imotko.mk/images/apple-play-icon.png"><img src="https://imotko.mk/images/google-play-icon.png">'

        const { html: inlined, inlineImages } = inlineHostedImages(html)

        assert.equal(
            inlined,
            '<img src="cid:logo-email@imotko.mk"><img src="cid:logo-email@imotko.mk">' +
                '<img src="cid:apple-play-icon@imotko.mk"><img src="cid:google-play-icon@imotko.mk">'
        )
        assert.deepEqual(
            inlineImages.map(image => image.cid),
            ["logo-email@imotko.mk", "apple-play-icon@imotko.mk", "google-play-icon@imotko.mk"]
        )
        // Real files shipped in src/messages/email/images: PNG signature
        for (const image of inlineImages) assert.equal(image.content.subarray(1, 4).toString(), "PNG")
    })

    it("returns the HTML unchanged when no hosted image is used", () => {
        const html = '<img src="https://imotko-bucket.s3.amazonaws.com/photo.jpg">'
        assert.deepEqual(inlineHostedImages(html), { html, inlineImages: [] })
    })

    it("keeps the hosted URL when the file cannot be read", () => {
        const html = '<img src="https://imotko.mk/icons/logo_email.png">'
        const warn = console.warn
        console.warn = () => {}
        try {
            const result = inlineHostedImages(html, () => {
                throw new Error("ENOENT")
            })
            assert.deepEqual(result, { html, inlineImages: [] })
        } finally {
            console.warn = warn
        }
    })
})
