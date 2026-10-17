import assert from "node:assert/strict"
import test from "node:test"

// Catches a broken alias rewrite in the files copied from the web by scripts/export_property_rules.mjs.
const MODULES = {
    "./events.js": ["ANALYTICS_EVENTS"],
    "./meta_events.js": ["META_EVENTS", "metaEventId", "buildListingMetaData", "toMetaListingType", "toMetaPropertyType"],
    "./meta_conversion.js": ["captureMetaConversion", "hashForMeta", "buildFbc"],
    "./listing_conversions.js": ["trackListingSubmitted", "trackListingPublished", "backfillUserLocationFromListing"],
    "../chat/listing_first_contact.js": ["trackListingFirstContact"],
    "../property_rules/seller_name.js": ["getDisplayName", "isNameMissing", "getEmailLocalPart", "shortDisplayName"],
}

for (const [path, names] of Object.entries(MODULES)) {
    test(`${path} loads and exports ${names.join(", ")}`, async () => {
        const mod = await import(path)
        names.forEach(name => assert.notEqual(mod[name], undefined, `${name} missing from ${path}`))
    })
}

test("the shared Meta ids and value maps match the web", async () => {
    const { metaEventId, buildListingMetaData } = await import("./meta_events.js")

    assert.equal(metaEventId.propertySubmitted("p1"), "property-submitted:p1")
    assert.deepEqual(buildListingMetaData({ listingType: "for_sale", type: "flat" }), {
        listing_type: "sale",
        property_type: "apartment",
        flow: "direct",
    })
})
