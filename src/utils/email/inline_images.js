// Port of imotko's src/lib/email/inline_images.js.
import fs from "node:fs"
import path from "node:path"

// Mail clients and their image proxies (Apple Mail Privacy Protection, Gmail) sometimes fail to fetch the hosted
// logo, so it ships inside the email as a cid: part instead. Same images as imotko web, shipped in src/messages/email/images.
const IMAGES_DIR = path.join(process.cwd(), "src/messages/email/images")

const INLINE_IMAGES = [
    {
        url: "https://imotko.mk/icons/logo_email.png",
        cid: "logo-email@imotko.mk",
        filename: "logo_email.png",
        filePath: () => path.join(IMAGES_DIR, "logo_email.png"),
    },
    {
        url: "https://imotko.mk/icons/logo_default.png",
        cid: "logo-default@imotko.mk",
        filename: "logo_default.png",
        filePath: () => path.join(IMAGES_DIR, "logo_default.png"),
    },
    {
        url: "https://imotko.mk/images/apple-play-icon.png",
        cid: "apple-play-icon@imotko.mk",
        filename: "apple-play-icon.png",
        filePath: () => path.join(IMAGES_DIR, "apple-play-icon.png"),
    },
    {
        url: "https://imotko.mk/images/google-play-icon.png",
        cid: "google-play-icon@imotko.mk",
        filename: "google-play-icon.png",
        filePath: () => path.join(IMAGES_DIR, "google-play-icon.png"),
    },
]

const imageCache = new Map()
const readImage = image => {
    if (!imageCache.has(image.cid)) imageCache.set(image.cid, fs.readFileSync(image.filePath()))
    return imageCache.get(image.cid)
}

// A missing file keeps the hosted URL, so the email still sends exactly as before.
export const inlineHostedImages = (html = "", read = readImage) => {
    let inlinedHtml = html
    const inlineImages = []

    for (const image of INLINE_IMAGES) {
        if (!inlinedHtml.includes(image.url)) continue
        let content
        try {
            content = read(image)
        } catch (error) {
            console.warn("[email] inline image unavailable, keeping hosted URL", {
                filename: image.filename,
                error: error instanceof Error ? error.message : String(error),
            })
            continue
        }
        inlinedHtml = inlinedHtml.split(image.url).join(`cid:${image.cid}`)
        inlineImages.push({ cid: image.cid, filename: image.filename, contentType: "image/png", content })
    }

    return { html: inlinedHtml, inlineImages }
}
