// COPIED FROM imotko/src/lib/property_image_storage.js by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).
import { v4 as uuidv4 } from "uuid"
import { UserRole } from "#generated/prisma/enums.ts"
import prisma from "#database/client.js"
import sharp from "sharp"
import { createHash } from "node:crypto"

const PROPERTY_IMAGE_BUCKET = "imotko-prod"
const PROPERTY_IMAGE_SIZES = [
    { key: "small", width: 300, quality: 60, suffix: "small" },
    { key: "medium", width: 650, quality: 60, suffix: "medium" },
    { key: "large", width: 900, quality: 60, suffix: "large" },
]

const WATERMARK_OPACITY = 0.05
const WATERMARK_CORNER_WIDTH_RATIO = 0.03
const WATERMARK_CORNER_MARGIN_RATIO = 0.02
const WATERMARK_EXIF_PUBLISHER = "Imotko.mk"

// SECURITY(N-5): cap decoded pixels so a tiny "decompression bomb" file cannot exhaust memory (sharp default is ~268 MP).
const MAX_INPUT_PIXELS = 60_000_000

sharp.cache(false)
sharp.concurrency(1)

const sanitizeStorageSegment = value => String(value || "").replace(/[^a-zA-Z0-9_-]/g, "_")
const getImageStorageScopeKey = ({ agencyId, userId }) =>
    agencyId ? `agency-${sanitizeStorageSegment(agencyId)}` : `user-${sanitizeStorageSegment(userId)}`

const getFileInfo = (fileName = "", mimeType = "") => {
    const extension = fileName.toLowerCase().split(".").pop()

    if (extension === "png" || mimeType === "image/png") {
        return { format: "png", extension: "png", contentType: "image/png" }
    } else if (["jpg", "jpeg"].includes(extension) || mimeType === "image/jpeg") {
        return { format: "jpeg", extension: "jpg", contentType: "image/jpeg" }
    } else if (extension === "webp" || mimeType === "image/webp") {
        return { format: "webp", extension: "webp", contentType: "image/webp" }
    }

    return { format: "jpeg", extension: "jpg", contentType: "image/jpeg" }
}

const getFileInfoFromStorageKey = (storageKey = "") => {
    const fileName = storageKey.split("/").at(-1) || storageKey
    return getFileInfo(fileName)
}

// Inlined copy of public/icons/logo_icon_white.svg: public/ is not bundled into Vercel functions.
const WATERMARK_SVG = `<svg opacity="${WATERMARK_OPACITY}" width="109" height="108" viewBox="0 0 109 108" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M46.0065 95.246H33.9023L27.5625 94.2707C26.2023 94.2707 22.0984 91.6753 21.2222 90.6349L19.1561 88.8823C18.8615 88.6324 18.5843 88.3605 18.3491 88.0542C16.1599 85.2037 15.8208 82.1697 18.7135 79.8663L41.4699 61.7454C43.121 60.4307 45.4539 60.4047 47.1337 61.6824L85.2009 90.6349C85.7865 92.9771 84.015 95.246 81.6007 95.246H73.6732H68.4857H62.7218H55.8051H46.0065Z" fill="white"/>
<path d="M38.783 34.3014C41.5038 32.0654 45.4153 32.0251 48.1808 34.2057L89.566 66.8449C90.8132 67.8285 91.5416 69.3295 91.5417 70.9179V91.499C91.5417 92.9313 90.3802 94.0925 88.9479 94.0927C87.5154 94.0927 86.3542 92.9315 86.3542 91.499V79.0244C86.354 77.7955 85.7937 76.6332 84.8322 75.8678L47.5605 46.2086C45.1828 44.3167 41.7968 44.3776 39.4888 46.3538L23.2092 60.2963C22.3143 61.0627 21.7988 62.1824 21.7986 63.3606V80.5476C21.7986 82.2983 20.3791 83.7175 18.6285 83.7177C16.8777 83.7177 15.4583 82.2984 15.4583 80.5476V55.9239C15.4586 54.3725 16.1534 52.9025 17.3519 51.9173L38.783 34.3014Z" fill="white" stroke="white" stroke-width="1.15278"/>
<path d="M35.0557 17.8994H71.9443C81.9718 17.8994 90.1006 26.0282 90.1006 36.0557V91.1006H35.0557C25.0282 91.1006 16.8994 82.9718 16.8994 72.9443V36.0557C16.8994 26.0282 25.0282 17.8994 35.0557 17.8994Z" stroke="white" stroke-width="9.79861"/>
</svg>`
const watermarkBufferCache = new Map()

// One faint mark sized relative to the output width, in the bottom-left corner,
// padded so gravity "southwest" leaves a margin.
const createWatermarkLayers = async imageWidth => {
    if (watermarkBufferCache.has(imageWidth)) return watermarkBufferCache.get(imageWidth)

    const cornerWidth = Math.max(10, Math.round(imageWidth * WATERMARK_CORNER_WIDTH_RATIO))
    const cornerMargin = Math.max(6, Math.round(imageWidth * WATERMARK_CORNER_MARGIN_RATIO))

    const corner = await sharp(Buffer.from(WATERMARK_SVG))
        .resize({ width: cornerWidth })
        .extend({ left: cornerMargin, bottom: cornerMargin, background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()

    const layers = [{ input: corner, gravity: "southwest" }]

    watermarkBufferCache.set(imageWidth, layers)
    return layers
}

// Written only to watermarked sizes; replaces any input EXIF, so camera details and GPS stay stripped.
const getWatermarkExif = imageId => ({
    IFD0: {
        Copyright: `Published on ${WATERMARK_EXIF_PUBLISHER}`,
        Artist: WATERMARK_EXIF_PUBLISHER,
        ImageDescription: `${WATERMARK_EXIF_PUBLISHER} image ${imageId}`,
    },
})

const encodeImageBuffer = async (
    inputBuffer,
    fileInfo,
    { width, quality = 90, rotation, autoOrient = false, watermark = false, imageId } = {}
) => {
    let sharpInstance = sharp(inputBuffer, { limitInputPixels: MAX_INPUT_PIXELS })

    if (autoOrient) sharpInstance = sharpInstance.rotate()
    if (rotation !== undefined) sharpInstance = sharpInstance.rotate(rotation)
    if (width) sharpInstance = sharpInstance.resize({ width })
    if (watermark && width) {
        sharpInstance = sharpInstance.composite(await createWatermarkLayers(width)).withExif(getWatermarkExif(imageId))
    }

    if (fileInfo.format === "png") {
        return sharpInstance
            .png({
                quality,
                compressionLevel: 6,
                adaptiveFiltering: false,
            })
            .toBuffer()
    }

    if (fileInfo.format === "webp") return sharpInstance.webp({ quality }).toBuffer()

    return sharpInstance.jpeg({ quality }).toBuffer()
}

const getImageStorageScope = async userId => {
    const agencyMember = await prisma.agencyMember.findUnique({
        where: {
            userId,
        },
        select: {
            agencyId: true,
        },
    })

    if (agencyMember?.agencyId) {
        return {
            agencyId: agencyMember.agencyId,
            scope: getImageStorageScopeKey({ agencyId: agencyMember.agencyId }),
        }
    }

    const user = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        select: {
            agencyId: true,
        },
    })

    if (user?.agencyId) {
        return {
            agencyId: user.agencyId,
            scope: getImageStorageScopeKey({ agencyId: user.agencyId }),
        }
    }

    return {
        agencyId: null,
        scope: getImageStorageScopeKey({ userId }),
    }
}

const createImageStoragePrefix = ({ scope, imageId, versionId = uuidv4() }) =>
    `uploads/${scope}/${sanitizeStorageSegment(imageId)}/${versionId}`

const getStorageKey = ({ prefix, suffix, extension }) => `${prefix}/${suffix}.${extension}`

const getPublicUrl = (supabase, storageKey) => {
    const {
        data: { publicUrl },
    } = supabase.storage.from(PROPERTY_IMAGE_BUCKET).getPublicUrl(storageKey)

    return publicUrl
}

const uploadBuffer = async (supabase, storageKey, buffer, contentType) => {
    const { error } = await supabase.storage.from(PROPERTY_IMAGE_BUCKET).upload(storageKey, buffer, {
        contentType,
        upsert: false,
    })

    if (error) throw error

    return getPublicUrl(supabase, storageKey)
}

const removeStorageKeys = async (supabase, keys = []) => {
    const uniqueKeys = [...new Set((keys || []).filter(Boolean))]
    if (!uniqueKeys.length) return

    const { error } = await supabase.storage.from(PROPERTY_IMAGE_BUCKET).remove(uniqueKeys)
    if (error) console.error("Error deleting from Supabase:", error)
}

const downloadStorageKey = async (supabase, storageKey) => {
    const { data, error } = await supabase.storage.from(PROPERTY_IMAGE_BUCKET).download(storageKey)

    if (error || !data) throw error || new Error("downloadFailed")

    const arrayBuffer = await data.arrayBuffer()
    return Buffer.from(arrayBuffer)
}

// 64-bit difference hash (dHash) as 16 hex chars. Survives resizing, recompression and the faint watermark,
// so a suspected copy can be matched back to an upload with getImageFingerprintDistance.
const getImageFingerprint = async inputBuffer => {
    const pixels = await sharp(inputBuffer, { limitInputPixels: MAX_INPUT_PIXELS })
        .greyscale()
        .resize(9, 8, { fit: "fill" })
        .raw()
        .toBuffer()

    let hash = 0n
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const bit = pixels[row * 9 + col] > pixels[row * 9 + col + 1] ? 1n : 0n
            hash = (hash << 1n) | bit
        }
    }

    return hash.toString(16).padStart(16, "0")
}

// Hamming distance between two fingerprints (0 = identical, 64 = unrelated). Roughly <= 10 means same photo.
const getImageFingerprintDistance = (fingerprintA, fingerprintB) => {
    let diff = BigInt(`0x${fingerprintA}`) ^ BigInt(`0x${fingerprintB}`)
    let distance = 0

    while (diff) {
        distance += Number(diff & 1n)
        diff >>= 1n
    }

    return distance
}

// The original stays clean; only the derived sizes carry the watermark, so they can be regenerated.
const storeNormalizedImageSet = async ({ supabase, normalizedBuffer, fileInfo, scope, imageId, watermark = false }) => {
    const prefix = createImageStoragePrefix({ scope, imageId })
    const uploadedKeys = []

    try {
        // Random suffix: the clean original shares a folder with the public sizes, so a fixed name
        // ("original.jpg") could be guessed by editing any public image URL.
        const originalKey = getStorageKey({ prefix, suffix: `original-${uuidv4()}`, extension: fileInfo.extension })
        await uploadBuffer(supabase, originalKey, normalizedBuffer, fileInfo.contentType)
        uploadedKeys.push(originalKey)

        const sizes = {}
        const s3Urls = [originalKey]
        const fingerprint = await getImageFingerprint(normalizedBuffer)
        // Exact hash of the stored original: proves which file we hold and when (with the upload timestamp).
        const sha256 = createHash("sha256").update(normalizedBuffer).digest("hex")

        for (const { key, width, quality, suffix } of PROPERTY_IMAGE_SIZES) {
            const resizedBuffer = await encodeImageBuffer(normalizedBuffer, fileInfo, {
                width,
                quality,
                watermark,
                imageId,
            })
            const storageKey = getStorageKey({ prefix, suffix, extension: fileInfo.extension })
            const publicUrl = await uploadBuffer(supabase, storageKey, resizedBuffer, fileInfo.contentType)

            sizes[key] = publicUrl
            s3Urls.push(storageKey)
            uploadedKeys.push(storageKey)
        }

        return {
            id: imageId,
            name: null,
            originalKey,
            sizes,
            s3Urls,
            fingerprint,
            sha256,
            ...(watermark ? { watermarked: true } : {}),
        }
    } catch (error) {
        await removeStorageKeys(supabase, uploadedKeys)
        throw error
    }
}

const storeUploadedImageSet = async ({ supabase, sourceBuffer, fileInfo, scope, imageId, watermark = false }) => {
    const normalizedBuffer = await encodeImageBuffer(sourceBuffer, fileInfo, { autoOrient: true, quality: 90 })
    return storeNormalizedImageSet({ supabase, normalizedBuffer, fileInfo, scope, imageId, watermark })
}

const rotateImageSet = async ({ supabase, sourceBuffer, fileInfo, scope, imageId, direction, watermark = false }) => {
    const rotation = direction === "left" ? -90 : 90
    const normalizedBuffer = await encodeImageBuffer(sourceBuffer, fileInfo, { rotation, quality: 90 })
    return storeNormalizedImageSet({ supabase, normalizedBuffer, fileInfo, scope, imageId, watermark })
}

const getOwnedImagePrefix = ({ scope, imageId }) => `uploads/${scope}/${sanitizeStorageSegment(imageId)}/`

const hasScopedImageOwnership = ({ image, scope }) => {
    const prefix = getOwnedImagePrefix({ scope, imageId: image?.id })
    const storageKeys = [image?.originalKey, ...(image?.s3Urls || [])].filter(Boolean)

    return storageKeys.length > 0 && storageKeys.every(storageKey => storageKey.startsWith(prefix))
}

// SECURITY(F-19): `images` from a request body later become storage keys that are downloaded/deleted with a
// service-role client. Accept a list only if every image is either unchanged from what is already stored on the
// record (older key layouts keep working) or lives inside the caller's own scope folder.
const areImagesOwnedOrUnchanged = ({ images, existingImages, scope }) => {
    if (images === undefined || images === null) return true
    if (!Array.isArray(images)) return false

    const existing = Array.isArray(existingImages) ? existingImages : []
    const sameStoredKeys = (a, b) =>
        (a?.originalKey ?? null) === (b?.originalKey ?? null) &&
        JSON.stringify(a?.s3Urls ?? null) === JSON.stringify(b?.s3Urls ?? null) &&
        (a?.sizes?.large ?? null) === (b?.sizes?.large ?? null)

    return images.every(image => {
        if (!image || typeof image !== "object") return false
        const stored = existing.find(entry => entry?.id && entry.id === image.id)
        if (stored && sameStoredKeys(stored, image)) return true
        return hasScopedImageOwnership({ image, scope })
    })
}

const getStorageKeyFromPublicUrl = (publicUrl = "") => {
    if (!publicUrl || typeof publicUrl !== "string") return undefined
    const marker = `/storage/v1/object/public/${PROPERTY_IMAGE_BUCKET}/`
    const markerIndex = publicUrl.indexOf(marker)
    if (markerIndex === -1) return undefined
    return publicUrl.slice(markerIndex + marker.length)
}

const getLegacyStorageKeys = (image = {}) => {
    if (!image?.sizes || typeof image.sizes !== "object") return []
    return ["small", "medium", "large"].map(size => getStorageKeyFromPublicUrl(image.sizes[size])).filter(Boolean)
}

const getImageLargeKey = (image = {}) => {
    if (!Array.isArray(image?.s3Urls)) return undefined

    return (
        image.s3Urls.find(storageKey => /(?:\/|-)large\.[^.]+$/i.test(storageKey)) ||
        image.s3Urls.find(storageKey => storageKey !== image.originalKey)
    )
}

const isMatchingPropertyImage = (storedImage = {}, image = {}) => {
    if (!storedImage || !image) return false

    if (storedImage?.id && image?.id && storedImage.id === image.id) return true

    return Boolean(storedImage?.sizes?.large && image?.sizes?.large && storedImage.sizes.large === image.sizes.large)
}

const getPropertyImagePool = (property, image) => {
    if (property?.photos?.some(photo => isMatchingPropertyImage(photo, image))) return "photos"
    if (property?.propertyPlan?.some(photo => isMatchingPropertyImage(photo, image))) return "propertyPlan"
    return null
}

const userCanMutateProperty = async ({ userId, userRole, propertyId }) => {
    const property = await prisma.property.findUnique({
        where: {
            id: propertyId,
        },
        select: {
            id: true,
            slug: true,
            agencyId: true,
            createdBy: true,
            photos: true,
            propertyPlan: true,
        },
    })

    if (!property) return { property: null, allowed: false }
    if (userRole === UserRole.ADMIN) return { property, allowed: true }
    if (property.createdBy === userId) return { property, allowed: true }

    const { agencyId } = await getImageStorageScope(userId)
    if (agencyId && property.agencyId && agencyId === property.agencyId) return { property, allowed: true }

    return { property, allowed: false }
}

export {
    PROPERTY_IMAGE_BUCKET,
    getFileInfo,
    getFileInfoFromStorageKey,
    getImageFingerprint,
    getImageFingerprintDistance,
    getImageLargeKey,
    getImageStorageScope,
    getImageStorageScopeKey,
    getStorageKeyFromPublicUrl,
    getLegacyStorageKeys,
    isMatchingPropertyImage,
    getPropertyImagePool,
    areImagesOwnedOrUnchanged,
    hasScopedImageOwnership,
    removeStorageKeys,
    rotateImageSet,
    sanitizeStorageSegment,
    storeUploadedImageSet,
    downloadStorageKey,
    userCanMutateProperty,
}
