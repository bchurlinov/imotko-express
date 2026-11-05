import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import sharp from "sharp"
import prisma from "#database/client.js"
import { removeStorageKeys, storeUploadedImageSet } from "#shared/property_rules/property_image_storage.js"
import { supabaseAdmin } from "#utils/supabaseClient.js"
import { deleteImageController, isAllowedImage, rotateImageController, uploadImagesController } from "./uploads.controller.js"

const originals = {
    agencyMemberFindUnique: prisma.agencyMember.findUnique,
    userFindUnique: prisma.user.findUnique,
    propertyFindUnique: prisma.property.findUnique,
    propertyUpdate: prisma.property.update,
}
afterEach(() => {
    prisma.agencyMember.findUnique = originals.agencyMemberFindUnique
    prisma.user.findUnique = originals.userFindUnique
    prisma.property.findUnique = originals.propertyFindUnique
    prisma.property.update = originals.propertyUpdate
    delete supabaseAdmin.storage
})

const fakeSupabase = () => {
    const uploads = new Map()
    return {
        uploads,
        storage: {
            from: () => ({
                upload: async (key, buffer) => {
                    uploads.set(key, buffer)
                    return { error: null }
                },
                getPublicUrl: key => ({ data: { publicUrl: `https://cdn/${key}` } }),
                remove: async () => ({ error: null }),
            }),
        },
    }
}

test("the pipeline stores a clean original and three watermarked sizes in the user's folder", async () => {
    const supabase = fakeSupabase()
    const source = await sharp({ create: { width: 1600, height: 1000, channels: 3, background: "#808080" } }).jpeg().toBuffer()
    const image = await storeUploadedImageSet({
        supabase,
        sourceBuffer: source,
        fileInfo: { format: "jpeg", extension: "jpg", contentType: "image/jpeg" },
        scope: "user-u1",
        imageId: "img1",
        watermark: true,
    })
    assert.equal(image.watermarked, true)
    assert.ok(image.originalKey.startsWith("uploads/user-u1/img1/"))
    assert.ok(image.s3Urls.every(key => key.startsWith("uploads/user-u1/img1/")))
    for (const [size, width] of [["small", 300], ["medium", 650], ["large", 900]]) {
        const key = image.sizes[size].replace("https://cdn/", "")
        const meta = await sharp(supabase.uploads.get(key)).metadata()
        assert.equal(meta.width, width)
        assert.ok(meta.exif.toString("latin1").includes("Imotko.mk"))
    }
})

// Fakes only the storage client, so the controller's real ownership check and key selection run.
const rotateWithFakeStorage = async (image, { role = "AGENCY", userId = "u1", property } = {}) => {
    const source = await sharp({ create: { width: 40, height: 20, channels: 3, background: "#808080" } }).jpeg().toBuffer()
    const removed = []
    const uploaded = []
    Object.defineProperty(supabaseAdmin, "storage", {
        configurable: true,
        value: {
            from: () => ({
                download: async () => ({ data: new Blob([source]), error: null }),
                upload: async key => {
                    uploaded.push(key)
                    return { error: null }
                },
                getPublicUrl: key => ({ data: { publicUrl: `https://cdn/${key}` } }),
                remove: async keys => {
                    removed.push(...keys)
                    return { error: null }
                },
            }),
        },
    })
    prisma.agencyMember.findUnique = async () => (property ? null : { agencyId: "a1" })
    prisma.user.findUnique = async () => null
    prisma.property.findUnique = async () => property || null
    prisma.property.update = async () => ({})
    const res = { status: () => res, json: () => res, set: () => res }
    const req = { chatViewer: { userId }, chatUser: { role }, body: { image, direction: "left", ...(property ? { propertyId: property.id } : {}) } }
    const outcome = await rotateImageController(req, res).then(
        () => "ok",
        error => error.status
    )
    return { outcome, removed, uploaded }
}

test("rotate refuses a size URL pointing at another agency's file and deletes nothing", async () => {
    const victimKey = "uploads/agency-victim/img9/v1/large.webp"
    const { outcome, removed } = await rotateWithFakeStorage({
        id: "img1",
        originalKey: "uploads/agency-a1/img1/v1/original-x.jpg",
        s3Urls: [],
        sizes: { small: `https://x.supabase.co/storage/v1/object/public/imotko-prod/${victimKey}` },
    })
    assert.equal(outcome, 403)
    assert.deepEqual(removed, [])
})

test("rotate deletes exactly the old keys of the caller's own image", async () => {
    const originalKey = "uploads/agency-a1/img1/v1/original-x.jpg"
    const small = "uploads/agency-a1/img1/v1/small.webp"
    const { outcome, removed } = await rotateWithFakeStorage({ id: "img1", originalKey, s3Urls: [originalKey, small] })
    assert.equal(outcome, "ok")
    assert.deepEqual(removed, [originalKey, small])
})

const noAgencyProperty = photos => ({
    id: "p1",
    slug: "s",
    agencyId: null,
    createdBy: "u-owner",
    photos,
    propertyPlan: [],
})

test("an admin rotates a new photo on someone else's no-agency listing", async () => {
    const originalKey = "uploads/user-u-owner/img1/v1/original-x.jpg"
    const small = "uploads/user-u-owner/img1/v1/small.webp"
    const property = noAgencyProperty([{ id: "img1", originalKey, s3Urls: [originalKey, small] }])
    const { outcome, removed } = await rotateWithFakeStorage({ id: "img1" }, { role: "ADMIN", userId: "u-admin", property })
    assert.equal(outcome, "ok")
    assert.deepEqual(removed, [originalKey, small])
})

test("an old photo on a no-agency listing rotates into the owner's folder and removes its root files", async () => {
    const base = "https://x.supabase.co/storage/v1/object/public/imotko-prod"
    const property = noAgencyProperty([
        { id: "old1", sizes: { small: `${base}/old1-small.jpg`, medium: `${base}/old1-medium.jpg`, large: `${base}/old1-large.jpg` } },
    ])
    const { outcome, removed, uploaded } = await rotateWithFakeStorage(
        { id: "old1" },
        { role: "ADMIN", userId: "u-admin", property }
    )
    assert.equal(outcome, "ok")
    assert.deepEqual(removed, ["old1-small.jpg", "old1-medium.jpg", "old1-large.jpg"])
    assert.ok(uploaded.length > 0)
    assert.ok(uploaded.every(key => key.startsWith("uploads/user-u-owner/old1/")))
})

const fakeDeleteStorage = ({ removeResult = { error: null } } = {}) => {
    const removed = []
    const lists = [
        { data: [{ name: "v1" }], error: null },
        { data: [{ name: "small.jpg" }, { name: "large.jpg" }], error: null },
    ]
    Object.defineProperty(supabaseAdmin, "storage", {
        configurable: true,
        value: {
            from: () => ({
                list: async () => lists.shift() ?? { data: [], error: null },
                remove: async keys => {
                    removed.push(...keys)
                    return removeResult
                },
            }),
        },
    })
    prisma.agencyMember.findUnique = async () => ({ agencyId: "a1" })
    return removed
}

test("delete only removes keys in the caller's folder", async () => {
    const removed = fakeDeleteStorage()
    const res = { status: () => res, json: () => res, set: () => res }
    await deleteImageController({ chatViewer: { userId: "u1" }, params: { id: "../../agency-victim/img9" } }, res)
    assert.ok(removed.length > 0)
    assert.ok(removed.every(key => key.startsWith("uploads/agency-a1/") && !key.includes("..")))
})

test("delete answers 500 on a storage error", async () => {
    fakeDeleteStorage({ removeResult: { error: new Error("boom") } })
    const res = { status: () => res, json: () => res, set: () => res }
    await assert.rejects(
        () => deleteImageController({ chatViewer: { userId: "u1" }, params: { id: "img1" } }, res),
        { status: 500 }
    )
})

test("the shared guard refuses another agency's key", async () => {
    const removed = []
    const supabase = { storage: { from: () => ({ remove: async keys => (removed.push(...keys), { error: null }) }) } }
    const own = "uploads/agency-a1/i/v/a.webp"
    const foreign = "uploads/agency-b/i/v/a.webp"
    const result = await removeStorageKeys(supabase, [own, foreign], { scope: "agency-a1" })
    assert.deepEqual(removed, [own])
    assert.deepEqual(result.refused, [foreign])
})

test("only jpeg, png, webp and avif up to 5 MB are accepted", () => {
    assert.equal(isAllowedImage({ size: 1000, mimetype: "image/jpeg", originalname: "a.jpg" }), true)
    assert.equal(isAllowedImage({ size: 1000, mimetype: "image/heic", originalname: "a.heic" }), false)
    assert.equal(isAllowedImage({ size: 6 * 1024 * 1024, mimetype: "image/png", originalname: "a.png" }), false)
    assert.equal(isAllowedImage({ size: 1000, mimetype: "", originalname: "a.webp" }), true)
    assert.equal(isAllowedImage({ size: 1000, mimetype: "image/avif", originalname: "a.avif" }), true)
    assert.equal(isAllowedImage({ size: 1000, mimetype: "", originalname: "a.AVIF" }), true)
})

test("a request without files or with a bad file stores nothing", async () => {
    await assert.rejects(() => uploadImagesController({ files: [], body: {}, chatViewer: { userId: "u1" } }, {}), {
        status: 400,
        code: "validationFailed",
    })
    await assert.rejects(
        () =>
            uploadImagesController(
                { files: [{ size: 10, mimetype: "application/pdf", originalname: "x.pdf" }], body: {}, chatViewer: { userId: "u1" } },
                {}
            ),
        { status: 400, code: "validationFailed" }
    )
})
