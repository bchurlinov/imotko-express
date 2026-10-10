// COPIED FROM imotko/src/schemas/property.schema.js by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).
import { PropertyCountry, PropertyType } from "#generated/prisma/enums.ts"
import { getPropertyDistrictsByCountryLocation, isPropertyLocationValidForCountry } from "./dictionaries/property.js"
import {
    getEnabledListingTypes,
    isRentalListingType,
    isPriceUnitAllowed,
    isPropertyTypeAllowed,
    isShortTermRent,
} from "./listing_type_rules.js"
import { hasContactDetails } from "./contact_details.js"
import * as yup from "yup"

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
const emptyToNull = (value, originalValue) => (originalValue === "" || originalValue === undefined ? null : value)
const optionalLocalizedString = (minimum, message) =>
    yup
        .string()
        .nullable()
        .transform((value, originalValue) => (originalValue === "" ? null : value))
        .test("optional-minimum", message, value => value == null || value.length >= minimum)

export const CLIENT_PROPERTY_TRANSLATION_FIELDS = [
    "nameMk",
    "nameEn",
    "nameSq",
    "nameTr",
    "descriptionMk",
    "descriptionEn",
    "descriptionSq",
    "descriptionTr",
]

export const stripClientPropertyTranslations = (body = {}) =>
    Object.fromEntries(Object.entries(body).filter(([key]) => !CLIENT_PROPERTY_TRANSLATION_FIELDS.includes(key)))

const hasDistrictOptions = (country, city) =>
    Boolean(city && getPropertyDistrictsByCountryLocation(country, city)?.length)

const isDistrictValidForLocation = (country, city, district) => {
    if (!district) return true

    const districtOptions = getPropertyDistrictsByCountryLocation(country, city)
    return districtOptions.some(option => option.value === district)
}

export const getPropertyRequiredFields = ({
    type,
    inDevelopment,
    propertyDeed,
    country,
    city,
    isAdmin,
    listingType,
} = {}) => {
    const isLand = type === PropertyType.land
    const isGarage = type === PropertyType.garage
    const isCommercial = type === PropertyType.commercial
    const hasPropertyDeed = typeof propertyDeed === "string" && propertyDeed.trim().length > 0
    const isShortTerm = isShortTermRent(listingType)

    return {
        listingType: true,
        type: true,
        propertySubType: true,
        propertyCadastralMunicipality: hasPropertyDeed,
        name: true,
        description: true,
        address: true,
        country: true,
        city: true,
        district: hasDistrictOptions(country, city),
        coordinates: true,
        orientation: !isLand && !isGarage,
        price: true,
        size: true,
        numOfRooms: !isLand && !isGarage && !isCommercial,
        numOfBathrooms: !isLand && !isGarage && !isCommercial,
        inDevelopmentUntil: Boolean(inDevelopment) && !isRentalListingType(listingType),
        maxGuests: isShortTerm,
        minNights: isShortTerm,
        images: (!Boolean(inDevelopment) || isRentalListingType(listingType)) && !Boolean(isAdmin),
    }
}

export const PropertySchema = yup.object().shape({
    name: yup.string().required("propertyNameRequired").min(5, "propertyNameLength"),
    nameMk: optionalLocalizedString(5, "propertyNameLength"),
    nameEn: optionalLocalizedString(5, "propertyNameLength"),
    nameSq: optionalLocalizedString(5, "propertyNameLength"),
    nameTr: optionalLocalizedString(5, "propertyNameLength"),
    description: yup.string().required("propertyDescriptionRequired").min(20, "propertyDescriptionLength"),
    descriptionMk: optionalLocalizedString(20, "propertyDescriptionLength"),
    descriptionEn: optionalLocalizedString(20, "propertyDescriptionLength"),
    descriptionSq: optionalLocalizedString(20, "propertyDescriptionLength"),
    descriptionTr: optionalLocalizedString(20, "propertyDescriptionLength"),
    address: yup.string().required("propertyAddressRequired").min(5, "propertyAddressLength"),
    country: yup
        .mixed()
        .oneOf(Object.values(PropertyCountry), "propertyCountryRequired")
        .default(PropertyCountry.macedonia)
        .required("propertyCountryRequired"),
    city: yup
        .string()
        .required("propertyLocationRequired")
        .test("valid-property-location", "propertyLocationRequired", function (value) {
            if (!value) return true
            return isPropertyLocationValidForCountry(this.parent?.country, "mk", value)
        }),
    district: yup
        .string()
        .nullable()
        .transform((value, originalValue) => {
            return originalValue === "" ? null : value
        })
        .when(["country", "city"], {
            is: (country, city) => hasDistrictOptions(country, city),
            then: schema => schema.required("propertyDistrictRequired"),
            otherwise: schema => schema.nullable().notRequired(),
        })
        .test("valid-property-district", "propertyDistrictRequired", function (value) {
            return isDistrictValidForLocation(this.parent?.country, this.parent?.city, value)
        }),
    propertyPlan: yup.array().nullable(),
    propertyDeed: yup
        .string()
        .nullable()
        .notRequired()
        .matches(/^[a-zA-Z0-9_\/-]+$/, {
            message: "propertyDeedInvalid",
            excludeEmptyString: true,
        }),
    propertyCadastralMunicipality: yup.string().when("propertyDeed", {
        is: propertyDeed => propertyDeed && propertyDeed.length > 0,
        then: schema => schema.required("propertyCadastralMunicipalityRequired"),
        otherwise: schema => schema.nullable(),
    }),
    price: yup.string().required("propertyPriceRequired"),
    hasApproximatePrice: yup.boolean().optional(),
    priceUnit: yup
        .mixed()
        .nullable()
        .notRequired()
        .test("price-unit-allowed", "priceUnitNotAllowed", function (value) {
            return isPriceUnitAllowed(this.parent?.listingType, value)
        }),
    maxGuests: yup
        .number()
        .nullable()
        .transform(emptyToNull)
        .typeError("maxGuestsRequired")
        .when("listingType", {
            is: isShortTermRent,
            then: schema =>
                schema.required("maxGuestsRequired").integer("maxGuestsRequired").min(1, "maxGuestsRequired"),
            otherwise: schema => schema.notRequired(),
        }),
    minNights: yup
        .number()
        .nullable()
        .transform(emptyToNull)
        .typeError("minNightsRequired")
        .when("listingType", {
            is: isShortTermRent,
            then: schema =>
                schema.required("minNightsRequired").integer("minNightsRequired").min(1, "minNightsRequired"),
            otherwise: schema => schema.notRequired(),
        }),
    checkInFrom: yup
        .string()
        .nullable()
        .notRequired()
        .matches(TIME_PATTERN, { message: "invalidTime", excludeEmptyString: true }),
    checkOutUntil: yup
        .string()
        .nullable()
        .notRequired()
        .matches(TIME_PATTERN, { message: "invalidTime", excludeEmptyString: true }),
    publishToFacebook: yup.boolean().optional(),
    // HOMMEX-DISABLED: the property form's Hommex opt-in; restore by uncommenting this line.
    // publishToHommex: yup.boolean().optional(),
    republishToFacebook: yup.boolean().optional(),
    verifiedByAgency: yup.boolean().optional(),
    size: yup.number("propertySizeInvalid").required("propertySizeRequired").moreThan(0, "propertySizeMustBePositive"),
    sizeOfYard: yup
        .number("propertySizeInvalid")
        .nullable()
        .transform((value, originalValue) => {
            return originalValue === "" ? null : value
        })
        .notRequired()
        .moreThan(0, "propertySizeMustBePositive"),
    video: yup
        .string()
        .nullable()
        .notRequired()
        .url("urlInvalid")
        .when([], {
            is: value => value !== undefined && value !== null && value !== "",
            then: schema => schema.matches(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/, "youtubeUrlInvalid"),
        }),
    listingType: yup
        .mixed()
        .required("propertyListingTypeRequired")
        .test("listing-type-enabled", "propertyListingTypeRequired", value => getEnabledListingTypes().includes(value)),
    type: yup
        .mixed()
        .oneOf(
            [
                PropertyType.flat,
                PropertyType.house,
                PropertyType.land,
                PropertyType.holiday_home,
                PropertyType.garage,
                PropertyType.commercial,
            ],
            "propertyTypeRequired"
        )
        .required("propertyTypeRequired")
        .test("type-allowed-for-listing-type", "propertyTypeNotAllowedForListingType", function (value) {
            return isPropertyTypeAllowed(this.parent?.listingType, value)
        }),
    propertySubType: yup.string().required("propertyListingSubTypeRequired"),
    // flatFloor: yup.number().notRequired(),
    // // .typeError("flatFloorInvalid")
    // // .when("type", {
    // //     is: PropertyType.flat,
    // //     then: (schema) => schema.required("flatFloorRequired"),
    // //     otherwise: (schema) => schema.notRequired(),
    // // }),
    // flatFloorFrom: yup.number().notRequired(),
    // // .typeError("flatFloorFromInvalid")
    // // .when("flatFloor", {
    // //     is: (val) => val,
    // //     then: (schema) =>
    // //         schema
    // //             .required("flatFloorFromRequired")
    // //             .test("is-greater-than-flatFloor", "flatFloorFromMustBeGreater", function (value, context) {
    // //                 const { flatFloor } = context.parent;
    // //                 return !flatFloor || !value || value >= flatFloor;
    // //             }),
    // //     otherwise: (schema) => schema.notRequired(),
    // // }),
    numOfRooms: yup.number("numOfRoomsInvalid").when("type", {
        is: val => val === PropertyType.land || val === PropertyType.garage || val === PropertyType.commercial,
        then: schema => schema.notRequired(),
        otherwise: schema => schema.required("numOfRoomsRequired"),
    }),
    numOfBathrooms: yup.number("numOfBathroomsInvalid").when("type", {
        is: val => val === PropertyType.land || val === PropertyType.garage || val === PropertyType.commercial,
        then: schema => schema.notRequired(),
        otherwise: schema => schema.required("numberOfBathroomsRequired"),
    }),
    numOfBalconies: yup
        .number("numOfBalconiesInvalid")
        .nullable()
        .transform((value, originalValue) => {
            return originalValue === "" ? null : value
        })
        .when("type", {
            is: val => val === PropertyType.land || val === PropertyType.garage || val === PropertyType.commercial,
            then: schema => schema.notRequired(),
            otherwise: schema => schema.notRequired(),
        }),
    inDevelopment: yup.boolean(),
    inDevelopmentUntil: yup.string().when(["inDevelopment", "listingType"], {
        is: (inDevelopment, listingType) => Boolean(inDevelopment) && !isRentalListingType(listingType),
        then: schema => schema.required("inDevelopmentUntilRequired"),
        otherwise: schema => schema.notRequired(),
    }),
    yearBuilt: yup.string().notRequired(),
    builder: yup.string().nullable(),
    coordinates: yup
        .array()
        .of(yup.number())
        .min(2, "propertyCoordinatesRequired")
        .max(2, "propertyCoordinatesRequired")
        .required("propertyCoordinatesRequired"),
    orientation: yup.mixed().when("type", {
        is: val => {
            return val && (val === PropertyType.land || val === PropertyType.garage)
        },
        then: schema => schema.notRequired(),
        otherwise: schema => schema.required("propertyOrientationRequired"),
    }),
    // Admins may save properties without images; pass `{ context: { isAdmin } }` when validating.
    images: yup
        .array()
        .nullable()
        .when(["inDevelopment", "listingType", "$isAdmin"], {
            is: (inDevelopment, listingType, isAdmin) =>
                (inDevelopment === true && !isRentalListingType(listingType)) || isAdmin === true,
            then: schema => schema.notRequired(),
            otherwise: schema => schema.required("propertyPhotosRequired").min(1, "propertyPhotosLength"),
        }),
    propertyOwner: yup.string().nullable(),
    propertyRenter: yup.string().nullable(),
    externalId: yup.string().nullable(),
})

const noContactDetails = value => value == null || !hasContactDetails(value)

// Client copy is translated asynchronously after submission. Client forms and routes must never validate or accept
// locale-specific copies. The title is written by the AI step (private listing AI cleanup §3.4): the web wizard sends
// none, and a title sent by the mobile app is replaced on the server.
export const ClientPropertySchema = PropertySchema.omit(CLIENT_PROPERTY_TRANSLATION_FIELDS).shape({
    name: yup
        .string()
        .transform((value, originalValue) => (originalValue === "" ? undefined : value))
        .notRequired()
        .min(5, "propertyNameLength")
        .test("no-contact-details", "contactDetailsNotAllowed", noContactDetails),
    description: PropertySchema.fields.description.test(
        "no-contact-details",
        "contactDetailsNotAllowed",
        noContactDetails
    ),
})
