// COPIED FROM imotko/src/lib/property/property_dto.js by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).
import { PropertyType } from "#generated/prisma/enums.ts"
import { PropertyTypeDictionary } from "./dictionaries/property.js"
import { normalizeListingTypeFields, pickShortTermAmenities } from "./listing_type_rules.js"
import { normalizePropertyCountry } from "./property_location.js"
import { sanitizeServer } from "./sanitize_server.js"
import { _isEmpty } from "./is_empty.js"

const TRUE_FLAGS = [
    "parking",
    "woodenFloors",
    "elevator",
    "kitchen",
    "heating",
    "renovated",
    "cellar",
    "interphone",
    "new",
    "used",
    "goodCondition",
    "usedButGoodCondition",
    "furnished",
    "duplex",
    "garden",
    "airCon",
    "pool",
    "balcony",
]

const TRUTHY_VALUES = [
    "numOfBathrooms",
    "numOfRooms",
    "numOfBalconies",
    "flatFloorFrom",
    "halfEmpty",
    "empty",
    "petFriendly",
    "fullyEquipped",
    "centralHeating",
    "utilityRoom",
    "fireplace",
    "gym",
    "solarPanels",
    "securitySystem",
    "soundProofing",
    "conferenceRoom",
    "serverRoom",
    "recreationalRoom",
    "personalHeating",
]

const localized = (body, key) => ({
    en: sanitizeServer(body[`${key}En`] || body[key]),
    mk: sanitizeServer(body[`${key}Mk`] || body[key]),
    sq: sanitizeServer(body[`${key}Sq`] || body[key]),
    tr: sanitizeServer(body[`${key}Tr`] || body[key]),
})

export const buildPropertyText = body => ({
    name: localized(body, "name"),
    description: localized(body, "description"),
})

export const buildPropertyAttributes = body => ({
    ...Object.fromEntries(TRUTHY_VALUES.filter(key => body[key]).map(key => [key, body[key]])),
    ...(body.type === PropertyType.house && body.sizeOfYard ? { sizeOfYard: +sanitizeServer(body.sizeOfYard) } : {}),
    ...Object.fromEntries(TRUE_FLAGS.filter(key => body[key]).map(key => [key, true])),
    ...(body.flatFloor !== undefined && body.flatFloor !== null ? { flatFloor: body.flatFloor } : {}),
    ...pickShortTermAmenities(body),
})

export const buildCorePropertyFields = body => ({
    ...buildPropertyText(body),
    hasApproximatePrice: body.hasApproximatePrice || false,
    price: Number(body.price),
    propertyDeed: sanitizeServer(body.propertyDeed),
    propertyCadastralMunicipality: body?.propertyCadastralMunicipality,
    orientation: body.orientation,
    type: body.type,
    builder: body.builder,
    video: body.video,
    address: body.address,
    district: body.district ? sanitizeServer(body.district) : null,
    country: normalizePropertyCountry(body.country),
    size: body.size ? +sanitizeServer(body.size) : null,
    latitude: body.coordinates.at(0),
    longitude: body.coordinates.at(1),
    listingType: body.listingType,
    yearBuilt: !_isEmpty(body.yearBuilt) ? new Date(body.yearBuilt) : undefined,
    inDevelopment: body.inDevelopment || false,
    inDevelopmentUntil: body.inDevelopmentUntil && new Date(body.inDevelopmentUntil),
    attributes: buildPropertyAttributes(body),
    ...normalizeListingTypeFields(body),
})

export const resolvePropertyTaxonomy = (type, propertySubType) => {
    const categoryId = PropertyTypeDictionary.mk?.find(category => category.value === type)?.id
    const subcategory = PropertyTypeDictionary.mk
        .flatMap(category => category.subcategories)
        .find(item => item.value === propertySubType)
    return categoryId && subcategory?.id ? { categoryId, subcategory } : null
}

export const upsertPropertyTaxonomy = async (tx, { type, categoryId, subcategory }) => {
    const category = await tx.propertyCategory.upsert({
        where: { id: categoryId },
        update: {},
        create: { id: categoryId, value: type },
    })
    const sub = await tx.propertySubcategory.upsert({
        where: { id: subcategory.id },
        update: {},
        create: { id: subcategory.id, value: subcategory.value, category: { connect: { id: category.id } } },
    })
    return { categoryId: category.id, subcategoryId: sub.id }
}
