import assert from "node:assert/strict"
import { test } from "node:test"
import {
    PHOTO_ORDER_MODEL,
    ROOM_RANK,
    ROOM_TYPES,
    applyRoomOrder,
    classifyPhotos,
    orderPropertyPhotos,
    photoUrlFor,
    shouldOrderPhotos,
} from "./photo_order.js"

const p = (id, medium = `https://x/${id}.webp`) => ({ id, sizes: { medium } })
const labels = rooms => rooms.map((room, index) => ({ index, room }))
const ids = photos => photos.map(photo => photo.id)
const makePhotos = count => Array.from({ length: count }, (_, i) => p(`p${i}`))

test("model and room types are exposed", () => {
    assert.equal(PHOTO_ORDER_MODEL, "gpt-4o")
    assert.deepEqual(ROOM_TYPES.slice().sort(), ROOM_RANK.flat.slice().sort())
    assert.deepEqual(ROOM_RANK.flat, [
        "living_room",
        "dining",
        "kitchen",
        "hallway",
        "other_room",
        "bedroom",
        "bathroom",
        "balcony",
        "view",
        "exterior",
        "other",
    ])
    assert.deepEqual(ROOM_RANK.house, [
        "exterior",
        "living_room",
        "dining",
        "kitchen",
        "hallway",
        "other_room",
        "bedroom",
        "bathroom",
        "balcony",
        "view",
        "other",
    ])
})

test("flat starts with the living room and exterior goes near the end", () => {
    const out = applyRoomOrder({
        photos: [p("bath"), p("ext"), p("living")],
        labels: labels(["bathroom", "exterior", "living_room"]),
        type: "flat",
    })
    assert.deepEqual(ids(out), ["living", "bath", "ext"])
})

test("house starts with the exterior", () => {
    const out = applyRoomOrder({
        photos: [p("bath"), p("ext"), p("living")],
        labels: labels(["bathroom", "exterior", "living_room"]),
        type: "house",
    })
    assert.deepEqual(ids(out), ["ext", "living", "bath"])
})

test("holiday_home uses the house order", () => {
    assert.deepEqual(ROOM_RANK.holiday_home, ROOM_RANK.house)
    const out = applyRoomOrder({
        photos: [p("bath"), p("ext"), p("living")],
        labels: labels(["bathroom", "exterior", "living_room"]),
        type: "holiday_home",
    })
    assert.deepEqual(ids(out), ["ext", "living", "bath"])
})

test("same-room photos keep the uploaded order", () => {
    const out = applyRoomOrder({
        photos: [p("a"), p("kitchen"), p("b")],
        labels: labels(["bedroom", "kitchen", "bedroom"]),
        type: "flat",
    })
    assert.deepEqual(ids(out), ["kitchen", "a", "b"])
})

test("invalid labels keep the original order", () => {
    const photos = [p("a"), p("b"), p("c")]
    const original = ids(photos)
    const cases = {
        "missing index": [{ room: "bedroom" }, { index: 1, room: "kitchen" }, { index: 2, room: "exterior" }],
        "duplicate index": [
            { index: 0, room: "bedroom" },
            { index: 0, room: "kitchen" },
            { index: 2, room: "living_room" },
        ],
        "out-of-range index": [
            { index: 0, room: "bedroom" },
            { index: 1, room: "kitchen" },
            { index: 3, room: "living_room" },
        ],
        "negative index": [
            { index: 0, room: "bedroom" },
            { index: 1, room: "kitchen" },
            { index: -1, room: "living_room" },
        ],
        "too few labels": labels(["bedroom", "kitchen"]),
        "too many labels": labels(["bedroom", "kitchen", "living_room", "other"]),
        "unknown room": labels(["bedroom", "garage", "living_room"]),
        "not an array": null,
    }
    for (const [name, invalid] of Object.entries(cases)) {
        const out = applyRoomOrder({ photos, labels: invalid, type: "flat" })
        assert.deepEqual(ids(out), original, name)
    }
})

test("no photo lost across random label sets", () => {
    const photos = makePhotos(20)
    const expected = ids(photos).sort()
    for (let round = 0; round < 200; round += 1) {
        const rooms = photos.map(() => ROOM_TYPES[Math.floor(Math.random() * ROOM_TYPES.length)])
        // Shuffle the label entries too, so index order in the array does not match photo order.
        const shuffled = labels(rooms).sort(() => Math.random() - 0.5)
        for (const type of ["flat", "house", "holiday_home"]) {
            const out = applyRoomOrder({ photos, labels: shuffled, type })
            assert.equal(out.length, photos.length)
            assert.deepEqual(ids(out).sort(), expected)
        }
    }
})

test("applyRoomOrder does not mutate its input", () => {
    const photos = [p("bath"), p("living")]
    applyRoomOrder({ photos, labels: labels(["bathroom", "living_room"]), type: "flat" })
    assert.deepEqual(ids(photos), ["bath", "living"])
})

test("shouldOrderPhotos skip rules", () => {
    const base = { orderPhotos: true, type: "flat", photos: makePhotos(5) }
    assert.equal(shouldOrderPhotos({ ...base, orderPhotos: false }), false)
    for (const type of ["land", "garage", "commercial"]) {
        assert.equal(shouldOrderPhotos({ ...base, type }), false, type)
    }
    assert.equal(shouldOrderPhotos({ ...base, photos: makePhotos(2) }), false)
    assert.equal(shouldOrderPhotos({ ...base, photos: makePhotos(31) }), false)
    assert.equal(shouldOrderPhotos({ ...base, photos: null }), false)
    assert.equal(shouldOrderPhotos({ ...base, photos: undefined }), false)
    assert.equal(shouldOrderPhotos({ ...base, photos: "x" }), false)
    for (const type of ["flat", "house", "holiday_home"]) {
        for (const count of [3, 30]) {
            assert.equal(shouldOrderPhotos({ ...base, type, photos: makePhotos(count) }), true, `${type} ${count}`)
        }
    }
})

test("photoUrlFor falls back medium, large, small, then null", () => {
    assert.equal(photoUrlFor({ sizes: { medium: "m", large: "l", small: "s" } }), "m")
    assert.equal(photoUrlFor({ sizes: { large: "l", small: "s" } }), "l")
    assert.equal(photoUrlFor({ sizes: { medium: "", large: "l" } }), "l")
    assert.equal(photoUrlFor({ sizes: { small: "s" } }), "s")
    assert.equal(photoUrlFor({ sizes: {} }), null)
    assert.equal(photoUrlFor({ sizes: null }), null)
    assert.equal(photoUrlFor({ s3Urls: ["https://x/a.jpg"] }), null)
    assert.equal(photoUrlFor(null), null)
    assert.equal(photoUrlFor(undefined), null)
})

test("orderPropertyPhotos reorders using the classifier labels", async () => {
    const photos = [p("bath"), p("ext"), p("living")]
    const calls = []
    const classify = async (input, options) => {
        calls.push({ input, options })
        return labels(["bathroom", "exterior", "living_room"])
    }
    const aiContext = { distinctId: "u1" }
    const out = await orderPropertyPhotos({ type: "flat", photos }, { orderPhotos: true, aiContext, classify })
    assert.deepEqual(ids(out), ["living", "bath", "ext"])
    assert.equal(calls.length, 1)
    assert.deepEqual(calls[0].input, photos)
    assert.equal(calls[0].options.aiContext, aiContext)
})

test("orderPropertyPhotos returns null when ordering is not requested or not applicable", async () => {
    let called = 0
    const classify = async () => {
        called += 1
        return []
    }
    assert.equal(await orderPropertyPhotos({ type: "flat", photos: makePhotos(5) }, { orderPhotos: false, classify }), null)
    assert.equal(await orderPropertyPhotos({ type: "land", photos: makePhotos(5) }, { orderPhotos: true, classify }), null)
    assert.equal(await orderPropertyPhotos({ type: "flat", photos: makePhotos(2) }, { orderPhotos: true, classify }), null)
    assert.equal(called, 0)
})

// Review focus 1: old records with only s3Urls have no sizes URL.
test("orderPropertyPhotos returns null when any photo has no usable URL, without calling classify", async () => {
    let called = 0
    const classify = async () => {
        called += 1
        return []
    }
    const photos = [p("a"), { id: "old", s3Urls: ["https://x/old.jpg"] }, p("c")]
    assert.equal(await orderPropertyPhotos({ type: "flat", photos }, { orderPhotos: true, classify }), null)
    const withNull = [p("a"), null, p("c")]
    assert.equal(await orderPropertyPhotos({ type: "flat", photos: withNull }, { orderPhotos: true, classify }), null)
    assert.equal(called, 0)
})

// Review focus 2: photos null or not an array must not crash.
test("orderPropertyPhotos returns null for null or non-array photos and a missing property", async () => {
    let called = 0
    const classify = async () => {
        called += 1
        return []
    }
    for (const photos of [null, undefined, "x", 5, { length: 5 }]) {
        assert.equal(await orderPropertyPhotos({ type: "flat", photos }, { orderPhotos: true, classify }), null)
    }
    assert.equal(await orderPropertyPhotos(null, { orderPhotos: true, classify }), null)
    assert.equal(await orderPropertyPhotos(undefined, { orderPhotos: true, classify }), null)
    assert.equal(called, 0)
})

test("orderPropertyPhotos returns null and logs only the error name when classify rejects", async t => {
    const logged = []
    for (const level of ["error", "warn", "log", "info"]) {
        t.mock.method(console, level, (...args) => logged.push(args))
    }
    const classify = async () => {
        const err = new Error("secret listing text https://x/a.webp")
        err.name = "APICallError"
        err.requestBodyValues = { prompt: "secret listing text" }
        throw err
    }
    const out = await orderPropertyPhotos({ type: "flat", photos: makePhotos(4) }, { orderPhotos: true, classify })
    assert.equal(out, null)
    const text = JSON.stringify(logged)
    assert.match(text, /APICallError/)
    assert.doesNotMatch(text, /secret|https:\/\/x/)
})

test("orderPropertyPhotos never rejects, even for a thrown non-error", async t => {
    t.mock.method(console, "error", () => {})
    const classify = () => {
        throw null
    }
    assert.equal(await orderPropertyPhotos({ type: "flat", photos: makePhotos(4) }, { orderPhotos: true, classify }), null)
})

const fakeGenerate = labelsToReturn => {
    const calls = []
    const generate = async args => {
        calls.push(args)
        return { output: { labels: labelsToReturn } }
    }
    return { generate, calls }
}

test("classifyPhotos sends one low-detail image part per photo", async () => {
    const photos = [
        p("a", "https://x/a-medium.webp"),
        { id: "b", sizes: { large: "https://x/b-large.webp" } },
        p("c", "https://x/c-medium.webp"),
    ]
    const expected = labels(["bedroom", "kitchen", "exterior"])
    const { generate, calls } = fakeGenerate(expected)

    const result = await classifyPhotos(photos, { generate })

    assert.deepEqual(result, expected)
    assert.equal(calls.length, 1)
    const [call] = calls
    assert.ok(call.abortSignal instanceof AbortSignal)
    assert.equal(typeof call.system, "string")
    assert.match(call.system, /^You label real estate listing photos by what each one shows\./)
    assert.ok(call.output)

    const [message] = call.messages
    assert.equal(message.role, "user")
    const imageParts = message.content.filter(part => part.type === "image")
    assert.equal(imageParts.length, 3)
    for (const part of imageParts) {
        assert.equal(part.providerOptions.openai.imageDetail, "low")
        assert.ok(part.image instanceof URL)
    }
    assert.deepEqual(
        imageParts.map(part => part.image.href),
        ["https://x/a-medium.webp", "https://x/b-large.webp", "https://x/c-medium.webp"]
    )
    // Each image is preceded by its index label.
    const texts = message.content.filter(part => part.type === "text").map(part => part.text)
    assert.ok(texts.includes("Photo 0:") && texts.includes("Photo 1:") && texts.includes("Photo 2:"))
    const order = message.content.map(part => (part.type === "text" ? part.text : "image"))
    const photoMarkers = order.filter(entry => /^Photo \d+:$/.test(entry) || entry === "image")
    assert.deepEqual(photoMarkers, ["Photo 0:", "image", "Photo 1:", "image", "Photo 2:", "image"])
})

test("classifyPhotos: gpt-5 gets reasoningEffort low and no temperature; gpt-4o gets temperature 0", async () => {
    const photos = makePhotos(3)
    const { generate, calls } = fakeGenerate(labels(["other", "other", "other"]))

    await classifyPhotos(photos, { generate, model: "gpt-5" })
    await classifyPhotos(photos, { generate, model: "gpt-4o" })
    await classifyPhotos(photos, { generate })

    const [gpt5, gpt4o, defaulted] = calls
    assert.equal(gpt5.providerOptions.openai.reasoningEffort, "low")
    assert.equal("temperature" in gpt5, false)
    assert.equal(gpt4o.temperature, 0)
    assert.equal(gpt4o.providerOptions?.openai?.reasoningEffort, undefined)
    assert.equal(defaulted.temperature, 0)
})

test("classifyPhotos propagates generate failures and a missing output", async () => {
    await assert.rejects(
        classifyPhotos(makePhotos(3), {
            generate: async () => {
                throw new Error("boom")
            },
        }),
        /boom/
    )
    await assert.rejects(classifyPhotos(makePhotos(3), { generate: async () => ({ output: null }) }))
})
