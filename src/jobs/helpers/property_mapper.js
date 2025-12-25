import crypto from "crypto"
import prisma from "#database/client.js"
import { importConfig } from "../config.js"
import { openai } from "@ai-sdk/openai"
import { generateText } from "ai"

/**
 * Property mapping module
 * Maps normalized external data to Property database model
 */

/**
 * Generates a consistent external ID from property data
 * Used for duplicate detection across imports
 * @param {Object} propertyData - Property data from external source
 * @returns {string} External ID hash
 */
export function generateExternalId(propertyData) {
    const normalizedTitle = (propertyData.title || "").toLowerCase().trim()
    const normalizedAddress = (propertyData.address || "").toLowerCase().trim()
    const normalizedLocation = (propertyData.location || "").toLowerCase().trim()

    // Create a consistent string representation
    const uniqueString = `${normalizedTitle}|${normalizedAddress}|${normalizedLocation}`

    // Generate SHA-256 hash for consistent ID
    const hash = crypto.createHash("sha256").update(uniqueString).digest("hex")

    // Return first 32 characters for reasonable length
    return `ext_${hash.substring(0, 32)}`
}

/**
 * Extracts external ID (agency property code) from property data using AI
 * Looks for patterns like "ШИФРА- 3518" or similar agency codes in title/description
 * @param {Object} propertyData - Property data with title and description
 * @param {string} propertyData.title - Property title
 * @param {string} propertyData.description - Property description
 * @returns {Promise<string|null>} External ID if found, null otherwise
 */
export async function extractExternalIdWithAI(propertyData) {
    try {
        const { title = "", description = "" } = propertyData
        const textToAnalyze = `Title: ${title}\n\nDescription: ${description}`

        const { text } = await generateText({
            model: openai("gpt-4o-mini"),
            prompt: `Analyze the following property listing and extract the agency's property code/ID if present.
                    Look for patterns like:
                    - "ШИФРА- 3518" (the ID would be "3518")
                    - "Код: 1234"
                    - "ID: ABC123"
                    - "Шифра: 5678"
                    - Any similar pattern indicating an agency property reference number

            Property data:
            ${textToAnalyze}
            IMPORTANT: Return ONLY the extracted ID/code as plain text (numbers and/or letters), nothing else. If no ID is found, return exactly the word "null" (without quotes). Do not include any prefixes, explanations, or additional text.
            Examples:
            - If you find "ШИФРА- 3518", return: 3518
            - If you find "Код: ABC123", return: ABC123
            - If no ID is found, return: null`,
            maxTokens: 50,
            temperature: 0,
        })

        const extractedId = text.trim()
        if (!extractedId || extractedId.toLowerCase() === "null") {
            console.log(`🤖 AI: No external ID found in property data`)
            return null
        }

        console.log(`🤖 AI: Extracted external ID: ${extractedId}`)
        return extractedId
    } catch (error) {
        console.error(`❌ Error extracting external ID with AI: ${error.message}`)
        return null
    }
}

/**
 * Checks if a property already exists in the database
 * @param {string} externalId - External ID to check
 * @returns {Promise<Object|null>} Existing property or null
 */
export async function checkDuplicate(externalId) {
    try {
        const existingProperty = await prisma.property.findFirst({
            where: {
                externalId: externalId,
            },
            select: {
                id: true,
                externalId: true,
                name: true,
                createdAt: true,
            },
        })

        if (existingProperty) return existingProperty
        return null
    } catch (error) {
        console.error(`❌ Error checking for duplicate (External ID: ${externalId}): ${error.message}`)
        throw error
    }
}

/**
 * Maps normalized data to Property model structure
 * @param {Object} normalizedData - Normalized property data
 * @returns {Object} Property creation object for Prisma
 */
export function mapToPropertyModel(normalizedData) {
    const propertyData = {
        name: normalizedData.name,
        latitude: normalizedData.latitude,
        longitude: normalizedData.longitude,
        address: normalizedData.address,
        price: normalizedData.price,
        size: normalizedData.size,
        description: normalizedData.description,
        type: normalizedData.type,
        listingType: normalizedData.listingType,
        ...(normalizedData.photos && { photos: normalizedData.photos }),
        ...(normalizedData.attributes && {
            attributes: normalizedData.attributes,
        }),
        agency: {
            connect: { id: importConfig.defaultAgencyId },
        },
        propertyLocation: {
            connect: { id: "cmafamjy10005jl04vingaam4" },
        },
        ...(normalizedData.externalId && {
            externalId: normalizedData.externalId,
        }),
        status: "PENDING",
        featured: false,
        orientation: "east",
        createdBy: "cmhf5i5pa000al104xq2gneiu",
        category: {
            connect: { id: "1" },
        },
        subcategory: {
            connect: { id: "101" },
        },
        createdByMember: {
            connect: {
                id: "cmhf5i5rv000el1041ygrzw4z",
            },
        },
    }

    const validation = validatePropertyData(propertyData)
    if (!validation.valid) throw new Error(`Missing required fields: ${validation.missingFields.join(", ")}`)

    return propertyData
}

/**
 * Saves a property to the database
 * @param {Object} propertyData - Property data to save
 * @returns {Promise<Object>} Created property
 */
export async function saveProperty(propertyData) {
    try {
        const createdProperty = await prisma.property.create({
            data: propertyData,
            select: {
                id: true,
                externalId: true,
                name: true,
                address: true,
                price: true,
                type: true,
                listingType: true,
                createdAt: true,
            },
        })
        console.log(
            `✅ Property saved successfully: ID ${createdProperty.id} (External ID: ${createdProperty.externalId})`
        )

        return createdProperty
    } catch (error) {
        // Task 5.4.8: Log failures with property data for debugging
        console.error(`❌ Failed to save property to database:`)
        console.error(`   Error: ${error.message}`)
        console.error(`   Property data:`, {
            externalId: propertyData.externalId,
            name: propertyData.name,
            address: propertyData.address,
            type: propertyData.type,
        })

        // Log stack trace for debugging
        if (error.stack) {
            console.error(`   Stack trace: ${error.stack}`)
        }

        throw error
    }
}

/**
 * Validates that all required fields are present
 * @param {Object} propertyData - Property data to validate
 * @returns {{valid: boolean, missingFields: string[]}} Validation result
 */
export function validatePropertyData(propertyData) {
    const requiredFields = [
        "name",
        "latitude",
        "longitude",
        "address",
        "price",
        "size",
        "description",
        "type",
        "listingType",
    ]

    const missingFields = requiredFields.filter(field => !propertyData[field])

    return {
        valid: missingFields.length === 0,
        missingFields,
    }
}
