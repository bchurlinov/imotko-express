import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isRealEmailDeliveryEnabled, resolveEmailDelivery } from "./delivery_policy.js"

describe("email delivery policy", () => {
    it("only delivers for real in production", () => {
        assert.equal(isRealEmailDeliveryEnabled({ ENV: "production" }), true)
        assert.equal(isRealEmailDeliveryEnabled({ NODE_ENV: "production" }), true)
        assert.equal(isRealEmailDeliveryEnabled({ ENV: "development" }), false)
        assert.equal(isRealEmailDeliveryEnabled({ ENV: "stage" }), false)
        assert.equal(isRealEmailDeliveryEnabled({}), false)
    })

    it("redirects outside production and marks the subject once", () => {
        const input = { to: ["client@example.com"], replyTo: ["sender@example.com"], subject: "Нова порака" }
        assert.deepEqual(resolveEmailDelivery(input, { ENV: "development" }), {
            redirected: true,
            toAddresses: ["bchurlinov@gmail.com"],
            replyToAddresses: ["bojan@imotko.mk"],
            subject: "[DEV] Нова порака",
        })
        assert.equal(resolveEmailDelivery({ ...input, subject: "[DEV] x" }, {}).subject, "[DEV] x")
    })

    it("keeps real recipients in production, deduped, and drops an empty reply-to", () => {
        assert.deepEqual(
            resolveEmailDelivery({ to: [" A@x.mk ", "a@x.mk", null, ""], subject: "Hi" }, { ENV: "production" }),
            { redirected: false, toAddresses: ["A@x.mk"], replyToAddresses: undefined, subject: "Hi" }
        )
        assert.throws(() => resolveEmailDelivery({ to: [] }, { ENV: "production" }))
    })
})
