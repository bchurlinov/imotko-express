import assert from "node:assert/strict"
import test from "node:test"
import { accountCreationIpKey } from "./account_creation_limit.service.js"

test("account creation counters normalize IPv4-mapped IPv6 and collapse IPv6 to /64", () => {
    assert.equal(accountCreationIpKey("::ffff:203.0.113.8"), "203.0.113.8")
    assert.equal(accountCreationIpKey("2001:db8:85a3:8d3::8a2e:370:7334"), "2001:0db8:85a3:08d3")
    assert.equal(accountCreationIpKey("Unknown"), null)
})
