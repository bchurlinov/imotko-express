import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { buildPropertyMessage, selectLargePhotoUrls } from "./message.js"

const property = {
    id: "property-1",
    slug: "stan-vo-centar",
    name: { mk: "Стан во Центар" },
    description: { mk: "<p>Прв пасус &amp; детали.</p><p>Втор пасус.</p>" },
    listingType: "for_sale",
    price: 120000,
    hasApproximatePrice: false,
    approximatePrice: null,
    size: 85,
    district: "Центар",
    propertyLocation: { name: "Скопје" },
}

describe("selectLargePhotoUrls", () => {
    test("keeps the first ten valid HTTPS large URLs in storage order", () => {
        const photos = Array.from({ length: 12 }, (_, index) => ({
            sizes: { large: `https://images.example/${index}.jpg` },
        }))
        photos.splice(2, 0, { sizes: { large: "http://images.example/insecure.jpg" } })

        assert.deepEqual(
            selectLargePhotoUrls(photos),
            Array.from({ length: 10 }, (_, index) => `https://images.example/${index}.jpg`)
        )
    })

    test("returns an empty array for malformed photo JSON", () => {
        assert.deepEqual(selectLargePhotoUrls(null), [])
        assert.deepEqual(selectLargePhotoUrls({}), [])
    })
})

describe("buildPropertyMessage", () => {
    test("builds the approved structured Macedonian sale message", () => {
        assert.equal(
            buildPropertyMessage(property, "https://imotko.mk"),
            [
                "Стан во Центар",
                "",
                "🏷️ За продажба",
                "📍 Скопје, Центар",
                "📐 85 м²",
                "💶 Цена: 120.000 €",
                "",
                "Прв пасус & детали.\n\nВтор пасус.",
                "",
                "🔗 https://imotko.mk/mk/nedviznini/stan-vo-centar/property-1",
            ].join("\n")
        )
    })

    test("keeps the full description without link labels or image URLs", () => {
        const result = buildPropertyMessage(
            {
                ...property,
                description: {
                    mk: '<p>Цел опис <a href="https://outside.example">без линк текст</a>.</p><img src="https://images.example/a.jpg"><p>Последен пасус.</p>',
                },
            },
            "https://imotko.mk"
        )

        assert.match(result, /Цел опис без линк текст\.\n\nПоследен пасус\./)
        assert.doesNotMatch(result, /https:\/\/outside\.example|https:\/\/images\.example\/a\.jpg/)
    })

    test("preserves list breaks and does not truncate a long description", () => {
        const longDescription = "Долг опис. ".repeat(1000)
        const result = buildPropertyMessage(
            {
                ...property,
                description: {
                    mk: `<p>Пред листа.</p><ul><li>Прва ставка</li><li>Втора ставка</li></ul><p>${longDescription}</p>`,
                },
            },
            "https://imotko.mk"
        )

        assert.match(result, /Пред листа\.\n\n \* Прва ставка\n \* Втора ставка\n\n/)
        assert.ok(result.includes(longDescription.trim()))
    })

    test("formats rent, approximate price, negotiated price, and all location combinations", () => {
        assert.match(
            buildPropertyMessage(
                { ...property, listingType: "for_rent", hasApproximatePrice: true, approximatePrice: 95000 },
                "https://imotko.mk"
            ),
            /🏷️ За изнајмување[\s\S]*💶 Приближна цена: 95\.000 €/
        )
        assert.match(buildPropertyMessage({ ...property, price: 0 }, "https://imotko.mk"), /💶 Цена: По договор/)
        assert.doesNotMatch(
            buildPropertyMessage({ ...property, district: null, propertyLocation: null }, "https://imotko.mk"),
            /📍/
        )
        assert.match(buildPropertyMessage({ ...property, district: null }, "https://imotko.mk"), /📍 Скопје/)
        assert.match(buildPropertyMessage({ ...property, propertyLocation: null }, "https://imotko.mk"), /📍 Центар/)
    })

    test("uses price when approximatePrice is absent or non-positive", () => {
        assert.match(
            buildPropertyMessage({ ...property, hasApproximatePrice: true, approximatePrice: 0 }, "https://imotko.mk"),
            /Приближна цена: 120\.000 €/
        )
    })

    test("renders stored integer size and formats every nonzero price", () => {
        const result = buildPropertyMessage({ ...property, size: 0, price: -120000 }, "https://imotko.mk")

        assert.match(result, /📐 0 м²/)
        assert.match(result, /💶 Цена: -120\.000 €/)
    })

    test("encodes property identity and normalizes a trailing-slash public URL", () => {
        const result = buildPropertyMessage(
            { ...property, slug: "стан / центар", id: "property/id?1" },
            "https://imotko.mk/"
        )

        assert.match(
            result,
            new RegExp(
                `🔗 https://imotko\\.mk/mk/nedviznini/${encodeURIComponent("стан / центар")}/${encodeURIComponent("property/id?1")}$`
            )
        )
    })

    test("rejects missing Macedonian content, slug, and unknown listing type", () => {
        assert.throws(() => buildPropertyMessage({ ...property, name: {} }, "https://imotko.mk"), /name\.mk/)
        assert.throws(
            () => buildPropertyMessage({ ...property, description: { mk: "" } }, "https://imotko.mk"),
            /description\.mk/
        )
        assert.throws(() => buildPropertyMessage({ ...property, slug: null }, "https://imotko.mk"), /slug/)
        assert.throws(
            () => buildPropertyMessage({ ...property, listingType: "unknown" }, "https://imotko.mk"),
            /listingType/
        )
    })
})
