import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import sharp from "sharp"
import prisma from "#database/client.js"
import { storeUploadedImageSet } from "#shared/property_rules/property_image_storage.js"
import { isAllowedImage, uploadImagesController } from "./uploads.controller.js"

const originals = { agencyMemberFindUnique: prisma.agencyMember.findUnique, userFindUnique: prisma.user.findUnique }
afterEach(() => {
    prisma.agencyMember.findUnique = originals.agencyMemberFindUnique
    prisma.user.findUnique = originals.userFindUnique
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

test("only jpeg, png and webp up to 5 MB are accepted", () => {
    assert.equal(isAllowedImage({ size: 1000, mimetype: "image/jpeg", originalname: "a.jpg" }), true)
    assert.equal(isAllowedImage({ size: 1000, mimetype: "image/heic", originalname: "a.heic" }), false)
    assert.equal(isAllowedImage({ size: 6 * 1024 * 1024, mimetype: "image/png", originalname: "a.png" }), false)
    assert.equal(isAllowedImage({ size: 1000, mimetype: "", originalname: "a.webp" }), true)
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
