import { convert } from "html-to-text"

const nonEmptyString = value => (typeof value === "string" && value.trim() ? value.trim() : null)

const localizedString = (value, fieldName) => {
    const localized = value && typeof value === "object" && !Array.isArray(value) ? nonEmptyString(value.mk) : null
    if (!localized) throw new Error(`${fieldName}.mk is required`)
    return localized
}

const plainTextDescription = html =>
    convert(html, {
        wordwrap: false,
        preserveNewlines: true,
        selectors: [
            { selector: "a", options: { ignoreHref: true } },
            { selector: "img", format: "skip" },
        ],
    })
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()

const formatNumber = value => new Intl.NumberFormat("mk-MK", { maximumFractionDigits: 0 }).format(value)

const formatPrice = property => {
    if (property.price === 0) return "Цена: По договор"

    if (property.hasApproximatePrice === true) {
        const approximatePrice = property.approximatePrice
        const value = Number.isInteger(approximatePrice) && approximatePrice > 0 ? approximatePrice : property.price
        return `Приближна цена: ${formatNumber(value)} €`
    }

    return `Цена: ${formatNumber(property.price)} €`
}

export function selectLargePhotoUrls(photos, limit = 10) {
    if (!Array.isArray(photos) || !Number.isInteger(limit) || limit <= 0) return []

    return photos
        .map(photo => photo?.sizes?.large)
        .filter(value => {
            if (typeof value !== "string") return false
            try {
                return new URL(value).protocol === "https:"
            } catch {
                return false
            }
        })
        .slice(0, limit)
}

export function buildPropertyMessage(property, publicAppUrl) {
    if (!property || typeof property !== "object") throw new Error("property is required")

    // const title = localizedString(property.name, "name")
    const descriptionHtml = localizedString(property.description, "description")
    const description = plainTextDescription(descriptionHtml)
    if (!description) throw new Error("description.mk must contain text")

    const slug = nonEmptyString(property.slug)
    if (!slug) throw new Error("slug is required")

    const id = nonEmptyString(property.id)
    if (!id) throw new Error("id is required")

    const listingLabel = { for_sale: "За продажба", for_rent: "За изнајмување" }[property.listingType]
    if (!listingLabel) throw new Error("listingType is invalid")

    return [description].join("\n")
}
