import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { appendImotkoEmailFooter } from "./email_footer.js"

const unsubscribe = {
    text: "Не сакате да добивате автоматски пораки од Имотко?",
    label: "Исклучете ги известувањата по е-пошта",
    link: "https://imotko.mk/mk/otkazi-izvestuvanja/t1",
}

describe("appendImotkoEmailFooter", () => {
    it("adds the footer without an unsubscribe line by default", () => {
        const html = appendImotkoEmailFooter("<html><body><p>Hi</p></body></html>")
        assert.ok(html.includes('data-imotko-footer="true"'))
        assert.ok(!html.includes("otkazi-izvestuvanja"))
        assert.ok(html.indexOf("</body>") > html.indexOf("data-imotko-footer"))
    })

    it("renders the unsubscribe line with a link before the store buttons", () => {
        const html = appendImotkoEmailFooter("<body></body>", { unsubscribe })
        assert.ok(html.includes(unsubscribe.text))
        assert.ok(html.includes(`<a href="${unsubscribe.link}"`))
        assert.ok(html.includes(`>${unsubscribe.label}</a>`))
        assert.ok(html.indexOf(unsubscribe.text) < html.indexOf("App Store"))
    })

    it("escapes the unsubscribe text and label", () => {
        const html = appendImotkoEmailFooter("<body></body>", {
            unsubscribe: { ...unsubscribe, text: "<b>x</b>", label: "<i>y</i>" },
        })
        assert.ok(html.includes("&lt;b&gt;x&lt;/b&gt;"))
        assert.ok(!html.includes("<b>x</b>"))
    })

    it("leaves html that already has the footer unchanged", () => {
        const once = appendImotkoEmailFooter("<body></body>", { unsubscribe })
        assert.equal(appendImotkoEmailFooter(once, { unsubscribe }), once)
    })

    it("renders each store button as a fixed-width table with vertically centred cells", () => {
        const html = appendImotkoEmailFooter("<body></body>")
        const buttons = html.match(/<table[^>]*width="170"[\s\S]*?<\/table>/g) ?? []
        assert.equal(buttons.length, 2)
        for (const button of buttons) {
            assert.ok((button.match(/vertical-align:middle/g) ?? []).length >= 2)
        }
        assert.ok(buttons[0].includes("App Store"))
        assert.ok(buttons[1].includes("Google Play"))
    })
})
