import multer from "multer"
import { v4 as uuidv4 } from "uuid"
import prisma from "#database/client.js"
import { supabaseAdmin } from "#utils/supabaseClient.js"
import { ClientListingError } from "#shared/property_rules/client_listing_error.js"
import {
    PROPERTY_IMAGE_BUCKET,
    downloadStorageKey,
    getFileInfo,
    getFileInfoFromStorageKey,
    getImageLargeKey,
    getImageStorageScope,
    getImageStorageScopeKey,
    getLegacyStorageKeys,
    getPropertyImagePool,
    getStorageKeyFromPublicUrl,
    hasScopedImageOwnership,
    isMatchingPropertyImage,
    removeStorageKeys,
    rotateImageSet,
    sanitizeStorageSegment,
    storeUploadedImageSet,
    userCanMutateProperty,
} from "#shared/property_rules/property_image_storage.js"
import { clientJson } from "#controllers/client/client_listing_response.js"

// Same server-side limits as the web's /api/upload (SECURITY N-5).
const MAX_FILES_PER_REQUEST = 10
const MAX_FILE_BYTES = 5 * 1024 * 1024
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"]
const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp"]
const ROTATION_DIRECTIONS = new Set(["left", "right"])

export const uploadFiles = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES_PER_REQUEST },
}).array("file", MAX_FILES_PER_REQUEST)

export const isAllowedImage = file => {
    if (!file || file.size > MAX_FILE_BYTES) return false
    if (file.mimetype) return ALLOWED_MIME_TYPES.includes(file.mimetype)
    return ALLOWED_EXTENSIONS.includes(
        String(file.originalname || "")
            .toLowerCase()
            .split(".")
            .pop()
    )
}

const fail = (status, code) => {
    throw new ClientListingError(code, status)
}

export const uploadImagesController = async (req, res) => {
    const files = req.files ?? []
    const watermark = req.body?.watermark === "true"
    if (!files.length || files.length > MAX_FILES_PER_REQUEST || !files.every(isAllowedImage)) fail(400, "validationFailed")

    const { scope } = await getImageStorageScope(req.chatViewer.userId)
    const data = []
    for (const file of files) {
        data.push(
            await storeUploadedImageSet({
                supabase: supabaseAdmin,
                sourceBuffer: file.buffer,
                fileInfo: getFileInfo(file.originalname, file.mimetype),
                scope,
                imageId: uuidv4(),
                watermark,
            })
        )
    }
    return clientJson(res, 201, null, data)
}

export const rotateImageController = async (req, res) => {
    let nextImage
    try {
        const userId = req.chatViewer.userId
        const { image, direction, propertyId } = req.body || {}
        if (!image?.id || !ROTATION_DIRECTIONS.has(direction)) fail(400, "somethingWentWrong")

        const storageContext = await getImageStorageScope(userId)
        let storageScope = storageContext.scope
        let currentImage = image
        let property = null
        let imagePool = null

        if (propertyId) {
            const { property: currentProperty, allowed } = await userCanMutateProperty({
                userId,
                userRole: req.chatUser.role,
                propertyId,
            })
            if (!currentProperty) fail(404, "noMatchingPropertyFound")
            if (!allowed) fail(403, "unauthorized")

            property = currentProperty
            storageScope = getImageStorageScopeKey({ agencyId: property?.agencyId, userId })
            imagePool = getPropertyImagePool(property, image)
            if (!imagePool) fail(404, "noMatchingPropertyFound")

            currentImage = property[imagePool]?.find(entry => isMatchingPropertyImage(entry, image))
            if (!currentImage) fail(404, "noMatchingPropertyFound")

            // SECURITY(F-19): stored keys are downloaded and deleted with the service-role client.
            const storesNewLayoutKeys = Boolean(currentImage.originalKey) || (currentImage.s3Urls?.length ?? 0) > 0
            if (storesNewLayoutKeys && !hasScopedImageOwnership({ image: currentImage, scope: storageScope })) {
                fail(403, "unauthorized")
            }
        }

        if (!propertyId && !hasScopedImageOwnership({ image: currentImage, scope: storageContext.scope })) {
            fail(403, "unauthorized")
        }

        const sourceKey =
            currentImage.originalKey ||
            getImageLargeKey(currentImage) ||
            getStorageKeyFromPublicUrl(currentImage?.sizes?.large)
        if (!sourceKey) fail(400, "somethingWentWrong")
        if (!currentImage.originalKey && !propertyId) fail(400, "somethingWentWrong")

        const sourceBuffer = await downloadStorageKey(supabaseAdmin, sourceKey)
        nextImage = await rotateImageSet({
            supabase: supabaseAdmin,
            sourceBuffer,
            fileInfo: getFileInfoFromStorageKey(sourceKey),
            scope: storageScope,
            imageId: currentImage.id,
            direction,
            // Only reliable when the source is the clean original; legacy images fall back to "large".
            watermark: currentImage?.watermarked === true && Boolean(currentImage.originalKey),
        })
        nextImage = { ...nextImage, name: currentImage?.name || null }

        if (propertyId && imagePool) {
            const nextImages = (property?.[imagePool] || []).map(entry =>
                entry?.id === currentImage.id ? { ...entry, ...nextImage } : entry
            )
            await prisma.property.update({
                where: { id: propertyId },
                data: { [imagePool]: nextImages, updatedAt: new Date() },
            })
        }

        const oldKeysToRemove =
            Array.isArray(currentImage.s3Urls) && currentImage.s3Urls.length > 0
                ? [currentImage.originalKey, ...currentImage.s3Urls]
                : [currentImage.originalKey, ...getLegacyStorageKeys(currentImage)]
        await removeStorageKeys(supabaseAdmin, oldKeysToRemove)

        return clientJson(res, 200, null, nextImage)
    } catch (error) {
        if (nextImage?.s3Urls?.length) await removeStorageKeys(supabaseAdmin, nextImage.s3Urls)
        throw error
    }
}

// SECURITY(F-05): the caller names an image id, never a storage key; only the caller's own scope folder is removed.
export const deleteImageController = async (req, res) => {
    if (!req.params.id) fail(400, "somethingWentWrong")
    const { scope } = await getImageStorageScope(req.chatViewer.userId)
    const imageFolder = `uploads/${scope}/${sanitizeStorageSegment(req.params.id)}`
    const bucket = supabaseAdmin.storage.from(PROPERTY_IMAGE_BUCKET)

    const { data: versions, error: listError } = await bucket.list(imageFolder, { limit: 100 })
    const keys = []
    for (const version of versions ?? []) {
        const { data: files } = await bucket.list(`${imageFolder}/${version.name}`, { limit: 100 })
        for (const file of files ?? []) keys.push(`${imageFolder}/${version.name}/${file.name}`)
    }
    const { error } = keys.length > 0 ? await bucket.remove(keys) : { error: listError }
    if (error) {
        console.error("[uploads] delete failed", error)
        fail(500, "somethingWentWrong")
    }
    return clientJson(res, 200, "Image successfully deleted.")
}
