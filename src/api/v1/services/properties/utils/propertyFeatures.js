import { PropertyType } from "@prisma/client"

/**
 * Dictionary of property features with their visibility rules based on property type
 * @typedef {Object} PropertyFeature
 * @property {string} name - The feature name (must match the key in Property.attributes JSON field)
 * @property {PropertyType[]} visible - Array of property types where this feature is applicable
 */

/**
 * @type {PropertyFeature[]}
 */
export const PropertyFeaturesDictionary = [
    {
        name: "utilityRoom",
        visible: [PropertyType.commercial, PropertyType.flat, PropertyType.holiday_home, PropertyType.house],
    },
    {
        name: "conferenceRoom",
        visible: [PropertyType.commercial],
    },
    {
        name: "serverRoom",
        visible: [PropertyType.commercial],
    },
    {
        name: "recreationalRoom",
        visible: [PropertyType.commercial],
    },
    {
        name: "halfEmpty",
        visible: [PropertyType.flat, PropertyType.house, PropertyType.commercial, PropertyType.holiday_home],
    },
    {
        name: "empty",
        visible: [PropertyType.flat, PropertyType.house, PropertyType.commercial, PropertyType.holiday_home],
    },
    {
        name: "parking",
        visible: [PropertyType.flat, PropertyType.house, PropertyType.commercial, PropertyType.holiday_home],
    },
    { name: "woodenFloors", visible: [PropertyType.flat, PropertyType.house, PropertyType.holiday_home] },
    {
        name: "elevator",
        visible: [PropertyType.flat, PropertyType.house, PropertyType.holiday_home, PropertyType.commercial],
    },
    {
        name: "kitchen",
        visible: [PropertyType.flat, PropertyType.house, PropertyType.holiday_home, PropertyType.commercial],
    },
    {
        name: "heating",
        visible: [
            PropertyType.flat,
            PropertyType.house,
            PropertyType.holiday_home,
            PropertyType.commercial,
            PropertyType.garage,
        ],
    },
    {
        name: "renovated",
        visible: [
            PropertyType.flat,
            PropertyType.house,
            PropertyType.holiday_home,
            PropertyType.commercial,
            PropertyType.garage,
        ],
    },
    {
        name: "airCon",
        visible: [
            PropertyType.flat,
            PropertyType.house,
            PropertyType.holiday_home,
            PropertyType.commercial,
            PropertyType.garage,
        ],
    },
    {
        name: "pool",
        visible: [PropertyType.flat, PropertyType.house, PropertyType.holiday_home],
    },
    {
        name: "balcony",
        visible: [PropertyType.flat, PropertyType.house, PropertyType.holiday_home],
    },
    {
        name: "cellar",
        visible: [PropertyType.flat, PropertyType.house, PropertyType.holiday_home],
    },
    {
        name: "interphone",
        visible: [PropertyType.flat, PropertyType.house, PropertyType.holiday_home, PropertyType.commercial],
    },
    {
        name: "new",
        visible: [
            PropertyType.flat,
            PropertyType.house,
            PropertyType.holiday_home,
            PropertyType.commercial,
            PropertyType.garage,
        ],
    },
    {
        name: "used",
        visible: [
            PropertyType.flat,
            PropertyType.house,
            PropertyType.holiday_home,
            PropertyType.commercial,
            PropertyType.garage,
        ],
    },
    {
        name: "goodCondition",
        visible: [
            PropertyType.flat,
            PropertyType.house,
            PropertyType.holiday_home,
            PropertyType.commercial,
            PropertyType.garage,
        ],
    },
    {
        name: "usedButGoodCondition",
        visible: [
            PropertyType.flat,
            PropertyType.house,
            PropertyType.holiday_home,
            PropertyType.commercial,
            PropertyType.garage,
        ],
    },
    {
        name: "furnished",
        visible: [PropertyType.flat, PropertyType.house, PropertyType.holiday_home],
    },
    {
        name: "garden",
        visible: [PropertyType.flat, PropertyType.house, PropertyType.holiday_home],
    },
    {
        name: "fireplace",
        visible: [PropertyType.flat, PropertyType.house, PropertyType.holiday_home],
    },
    {
        name: "securitySystem",
        visible: [
            PropertyType.flat,
            PropertyType.house,
            PropertyType.holiday_home,
            PropertyType.commercial,
            PropertyType.garage,
        ],
    },
    {
        name: "gym",
        visible: [PropertyType.flat, PropertyType.house, PropertyType.holiday_home],
    },
    {
        name: "solarPanels",
        visible: [PropertyType.flat, PropertyType.house, PropertyType.holiday_home],
    },
    {
        name: "soundProofing",
        visible: [PropertyType.flat, PropertyType.house, PropertyType.holiday_home, PropertyType.commercial],
    },
]

/**
 * Validates if a feature name exists in the PropertyFeaturesDictionary
 * @param {string} featureName - The feature name to validate
 * @returns {boolean} - True if the feature exists
 */
export const isValidPropertyFeature = featureName => {
    return PropertyFeaturesDictionary.some(feature => feature.name === featureName)
}

/**
 * Get all valid property feature names
 * @returns {string[]} - Array of all feature names
 */
export const getAllPropertyFeatureNames = () => {
    return PropertyFeaturesDictionary.map(feature => feature.name)
}
