import { generateText, Output } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"
import { flushAiObservability, observeLanguageModel } from "#shared/ai/posthog_observability.js"

export const PHOTO_ORDER_MODEL = "gpt-4o"

const MIN_PHOTOS = 3
const MAX_PHOTOS = 30
const LLM_TIMEOUT_MS = 120_000

const FLAT_RANK = [
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
]

const HOUSE_RANK = [
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
]

export const ROOM_TYPES = [...FLAT_RANK]

export const ROOM_RANK = {
    flat: FLAT_RANK,
    house: HOUSE_RANK,
    holiday_home: HOUSE_RANK,
}

const SYSTEM_PROMPT = `You label real estate listing photos by what each one shows. Return exactly one label per photo, using the photo's index.
- exterior: the building or house from outside, a yard, or an entrance seen from outside.
- living_room, dining, kitchen, hallway, bedroom, bathroom: as named. An open-plan room is labelled by its main area.
- other_room: a study, kids room, utility room, or storage room, or an interior room that is unclear.
- balcony: a balcony or terrace.
- view: the view from the property, with no part of the property as the subject.
- other: floor plans, maps, logos, documents, and anything else.`

const LABELS_SCHEMA = z.object({
    labels: z.array(z.object({ index: z.number().int(), room: z.enum(ROOM_TYPES) })),
})

const isOrderableType = type => Object.hasOwn(ROOM_RANK, type)

export const shouldOrderPhotos = ({ orderPhotos, type, photos } = {}) =>
    orderPhotos === true &&
    isOrderableType(type) &&
    Array.isArray(photos) &&
    photos.length >= MIN_PHOTOS &&
    photos.length <= MAX_PHOTOS

const usableUrl = value => (typeof value === "string" && value.length > 0 ? value : null)

export const photoUrlFor = photo => {
    const sizes = photo?.sizes
    if (!sizes || typeof sizes !== "object") return null
    return usableUrl(sizes.medium) || usableUrl(sizes.large) || usableUrl(sizes.small) || null
}

// Returns a new array in the room order, or a copy of the input order when the labels are not one valid label per photo.
export const applyRoomOrder = ({ photos, labels, type }) => {
    const original = [...photos]
    const rank = ROOM_RANK[type]
    if (!rank || !Array.isArray(labels) || labels.length !== photos.length) return original

    const roomByIndex = new Array(photos.length)
    for (const label of labels) {
        const index = label?.index
        if (!Number.isInteger(index) || index < 0 || index >= photos.length) return original
        if (roomByIndex[index] !== undefined) return original
        if (!rank.includes(label.room)) return original
        roomByIndex[index] = label.room
    }

    return photos
        .map((photo, index) => ({ photo, index, rank: rank.indexOf(roomByIndex[index]) }))
        .sort((a, b) => a.rank - b.rank || a.index - b.index)
        .map(entry => entry.photo)
}

const isReasoningModel = model => /^(gpt-5|o\d)/.test(model)

export const classifyPhotos = async (photos, { model = PHOTO_ORDER_MODEL, aiContext, generate = generateText } = {}) => {
    const content = [{ type: "text", text: "Label each photo below." }]
    photos.forEach((photo, index) => {
        content.push({ type: "text", text: `Photo ${index}:` })
        content.push({
            type: "image",
            image: new URL(photoUrlFor(photo)),
            providerOptions: { openai: { imageDetail: "low" } },
        })
    })

    try {
        const { output } = await generate({
            model: observeLanguageModel(openai(model), { ...aiContext, traceName: "property_photo_order" }),
            output: Output.object({ schema: LABELS_SCHEMA }),
            // Reasoning models take no temperature.
            ...(isReasoningModel(model)
                ? { providerOptions: { openai: { reasoningEffort: "low" } } }
                : { temperature: 0 }),
            system: SYSTEM_PROMPT,
            messages: [{ role: "user", content }],
            abortSignal: AbortSignal.timeout(LLM_TIMEOUT_MS),
        })
        if (!Array.isArray(output?.labels)) throw new TypeError("Photo classification returned no labels")
        return output.labels
    } finally {
        flushAiObservability()
    }
}

// Resolves to the reordered photos, or null when the order should stay as uploaded. Never rejects.
export const orderPropertyPhotos = async (property, { orderPhotos, aiContext, classify = classifyPhotos } = {}) => {
    try {
        const type = property?.type
        const photos = property?.photos
        if (!shouldOrderPhotos({ orderPhotos, type, photos })) return null
        // Old records may only have s3Urls: without a sizes URL for every photo the whole listing keeps its order.
        if (photos.some(photo => photoUrlFor(photo) === null)) return null

        const labels = await classify(photos, { aiContext })
        return applyRoomOrder({ photos, labels, type })
    } catch (err) {
        console.error("[property-ai] photo ordering skipped", err?.name)
        return null
    }
}
