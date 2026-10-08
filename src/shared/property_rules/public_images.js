// COPIED FROM imotko/src/lib/public_api_fields.js (only: toPublicImage, withPublicImages) by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).

export const toPublicImage = ({ id, name, sizes } = {}) => ({ id, name, sizes })

export const withPublicImages = property => {
    if (!property) return property

    return {
        ...property,
        ...(Array.isArray(property.photos) ? { photos: property.photos.map(toPublicImage) } : {}),
        ...(Array.isArray(property.propertyPlan) ? { propertyPlan: property.propertyPlan.map(toPublicImage) } : {}),
    }
}
