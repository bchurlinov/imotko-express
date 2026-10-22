import assert from "node:assert/strict"
import test from "node:test"
import { DEFAULT_TRUST_PROXY_HOPS, isDebugIpRouteEnabled, resolveTrustProxyHops } from "./server.config.js"

test("trust proxy hops default to the Railway value when unset", () => {
    assert.equal(resolveTrustProxyHops({}), DEFAULT_TRUST_PROXY_HOPS)
    assert.equal(DEFAULT_TRUST_PROXY_HOPS, 2)
})

test("trust proxy hops read a whole number from the environment", () => {
    assert.equal(resolveTrustProxyHops({ TRUST_PROXY_HOPS: "1" }), 1)
    assert.equal(resolveTrustProxyHops({ TRUST_PROXY_HOPS: " 3 " }), 3)
    assert.equal(resolveTrustProxyHops({ TRUST_PROXY_HOPS: "0" }), 0)
})

test("invalid trust proxy hops fall back to the default instead of trusting everything", () => {
    for (const value of ["", "true", "-1", "1.5", "loopback", "2abc"]) {
        assert.equal(resolveTrustProxyHops({ TRUST_PROXY_HOPS: value }), DEFAULT_TRUST_PROXY_HOPS, value)
    }
})

test("the IP debug route is only enabled by the exact flag", () => {
    assert.equal(isDebugIpRouteEnabled({ DEBUG_IP_ROUTE: "true" }), true)
    for (const value of [undefined, "", "1", "TRUE", "yes"]) {
        assert.equal(isDebugIpRouteEnabled({ DEBUG_IP_ROUTE: value }), false, String(value))
    }
})
