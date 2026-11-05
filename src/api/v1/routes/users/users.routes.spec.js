import assert from "node:assert/strict"
import test from "node:test"

// Dummy values, set before the imports so dotenv cannot load real ones. Nothing here reaches Supabase or the database.
Object.assign(process.env, {
    SUPABASE_URL: "http://127.0.0.1:9",
    SUPABASE_ANON_KEY: "test-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    SUPABASE_JWKS_URL: "http://127.0.0.1:9/jwks",
    DATABASE_URL: "postgresql://test:test@127.0.0.1:9/test",
    DIRECT_URL: "postgresql://test:test@127.0.0.1:9/test",
})

const { default: router } = await import("./users.routes.js")
const { requireChatAdmin, resolveChatViewer } = await import("#middlewares/resolveChatViewer.js")
const { verifySupabaseToken } = await import("#middlewares/verifySupabaseToken.js")
const { findOrCreateUserController, toFindOrCreateUserInput } = await import("#controllers/users/users.controller.js")

const createUserRoute = () =>
    router.stack.find(layer => layer.route?.path === "/" && layer.route.methods.post).route

const statusFrom = (middleware, req) =>
    new Promise(resolve => {
        middleware(req, {}, error => resolve(error?.status ?? "passed"))
    })

test("POST /users checks for an admin before anything else runs", () => {
    const handlers = createUserRoute().stack.map(layer => layer.handle)

    assert.equal(handlers[0], resolveChatViewer)
    assert.equal(handlers[1], requireChatAdmin)
})

test("POST /users rejects a request without a token", async () => {
    assert.equal(await statusFrom(resolveChatViewer, { headers: {} }), 401)
})

test("POST /users rejects every non-admin viewer", async () => {
    assert.equal(await statusFrom(requireChatAdmin, {}), 403)
    assert.equal(await statusFrom(requireChatAdmin, { chatViewer: { type: "client" } }), 403)
    assert.equal(await statusFrom(requireChatAdmin, { chatViewer: { type: "agency" } }), 403)
})

test("POST /users lets a platform admin through", async () => {
    assert.equal(await statusFrom(requireChatAdmin, { chatViewer: { type: "admin" } }), "passed")
})

test("POST /users/create-user verifies the token before anything else runs", () => {
    const route = router.stack.find(layer => layer.route?.path === "/create-user" && layer.route.methods.post).route

    assert.equal(route.stack[0].handle, verifySupabaseToken)
})

test("POST /users/create-user rejects a request without a token", async () => {
    assert.equal(await statusFrom(verifySupabaseToken, { headers: {} }), 401)
})

test("POST /users/create-user uses the token's email and ignores body identity fields", () => {
    const input = toFindOrCreateUserInput({
        user: { email: "me@example.test" },
        body: {
            email: "victim@example.test",
            email_confirmed_at: "2026-01-01T00:00:00Z",
            role: "ADMIN",
            fullName: "Me",
            avatarUrl: "https://example.test/me.png",
        },
    })

    assert.deepEqual(input, { email: "me@example.test", fullName: "Me", avatarUrl: "https://example.test/me.png" })
})

test("POST /users/create-user answers 400 when the token has no email", async () => {
    const status = await new Promise(resolve => {
        findOrCreateUserController({ user: {}, body: { email: "victim@example.test" } }, {}, error =>
            resolve(error?.status)
        )
    })

    assert.equal(status, 400)
})
