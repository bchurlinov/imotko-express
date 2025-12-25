import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import { importConfig } from "../config.js"
import prisma from "#database/client.js"

/**
 * Geocoding module for property addresses
 * Converts addresses to latitude/longitude coordinates
 */

// Cache for geocoded locations to avoid duplicate API calls
const geocodeCache = new Map()

// Default coordinates for Skopje center (fallback)
const DEFAULT_COORDINATES = {
    latitude: 41.9973,
    longitude: 21.428,
}

/**
 * Geocodes an address to latitude and longitude using AI
 * @param {string} location - Location/city name
 * @param {string} address - Full address
 * @returns {Promise<{latitude: number, longitude: number}>} Coordinates
 */
export async function geocodeAddress(location, address) {
    const cacheKey = `${location}|${address}`.toLowerCase().trim()

    if (geocodeCache.has(cacheKey)) {
        const cached = geocodeCache.get(cacheKey)
        console.log(`📍 Using cached coordinates for: ${location}, ${address}`)
        return cached
    }

    try {
        const fullAddress = address ? `${address}, ${location}` : location
        const result = await generateText({
            model: openai("gpt-4o-mini"),
            temperature: 0.2,
            maxTokens: 100,
            prompt: `You are a geocoding assistant specialized in North Macedonia (Macedonia) locations.
                     Given the following address, provide the approximate latitude and longitude coordinates.

                    Address: "${fullAddress}"
                    
                    Important context:
                    - This is a location in North Macedonia (Macedonia)
                    - Common cities: Скопје (Skopje), Битола (Bitola), Прилеп (Prilep), Куманово (Kumanovo), Охрид (Ohrid), Велес (Veles), Штип (Shtip), Тетово (Tetovo)
                    - Skopje (Скопје) center coordinates: approximately 41.9973°N, 21.4280°E
                    - If you recognize specific neighborhoods or areas within cities, provide more precise coordinates
                    - If the exact location is unknown, provide coordinates for the city center
                    
                    Return your response in this EXACT format (only numbers, no extra text):
                    latitude: 41.9973
                    longitude: 21.4280`,
        })
        const lines = result.text.trim().split("\n")
        const latLine = lines.find(l => l.toLowerCase().includes("latitude"))
        const lonLine = lines.find(l => l.toLowerCase().includes("longitude"))

        if (!latLine || !lonLine) throw new Error("Could not parse coordinates from AI response")
        const latitude = parseFloat(latLine.split(":")[1].trim())
        const longitude = parseFloat(lonLine.split(":")[1].trim())

        if (
            isNaN(latitude) ||
            isNaN(longitude) ||
            latitude < 40.0 ||
            latitude > 43.0 ||
            longitude < 20.0 ||
            longitude > 24.0
        ) {
            throw new Error(`Invalid coordinates returned: ${latitude}, ${longitude}`)
        }

        const coordinates = { latitude, longitude }
        geocodeCache.set(cacheKey, coordinates)
        return coordinates
    } catch (error) {
        console.error(`❌ Geocoding failed for: ${location}, ${address}`, error.message)
        console.warn(`⚠️  Using default coordinates (Skopje center) for: ${location}`)

        // Return default Skopje coordinates as fallback
        const fallback = { ...DEFAULT_COORDINATES }

        // Cache the fallback too (to avoid repeated failures)
        geocodeCache.set(cacheKey, fallback)

        return fallback
    }
}

/**
 * Maps location text to PropertyLocation database entry
 * @param {string} locationText - Location string (e.g., "Центар, Скопjе")
 * @returns {Promise<string|null>} PropertyLocation ID or null
 */
export async function mapPropertyLocation(locationText) {
    if (!locationText) {
        console.warn("⚠️  No location text provided")
        return null
    }

    try {
        console.log(`🗺️  Mapping location: "${locationText}"`)

        // Parse location string (usually format: "District, City" or just "City")
        const parts = locationText.split(",").map(p => p.trim())
        const searchTerm = parts[0] // Use first part (usually district/municipality)

        // Query PropertyLocation table for matching records
        // Try exact match first
        let propertyLocation = await prisma.propertyLocation.findFirst({
            where: {
                name: {
                    equals: searchTerm,
                    mode: "insensitive",
                },
            },
        })

        if (propertyLocation) {
            console.log(`✅ Found exact match: "${searchTerm}" → ${propertyLocation.id}`)
            return propertyLocation.id
        }

        // Try partial match
        propertyLocation = await prisma.propertyLocation.findFirst({
            where: {
                name: {
                    contains: searchTerm,
                    mode: "insensitive",
                },
            },
        })

        if (propertyLocation) {
            console.log(`✅ Found partial match: "${searchTerm}" → ${propertyLocation.name} (${propertyLocation.id})`)
            return propertyLocation.id
        }

        // If no match found, try AI-based fuzzy matching
        const allLocations = await prisma.propertyLocation.findMany({
            select: {
                id: true,
                name: true,
            },
        })

        if (allLocations.length === 0) {
            console.warn(`⚠️  No PropertyLocation records in database`)
            return null
        }

        // Use AI to find best match
        const locationNames = allLocations.map(l => l.name).join(", ")

        const result = await generateText({
            model: openai("gpt-4o-mini"),
            prompt: `You are helping map location names to database entries.

Given location: "${searchTerm}"

Available locations in database:
${locationNames}

Find the BEST matching location name from the available locations. Consider:
- Exact matches (highest priority)
- Similar names (transliterations, different spellings)
- District/municipality mappings
- Common Macedonian location names

If you find a match, return ONLY the matching location name exactly as it appears in the available locations.
If NO good match exists, return the word "NONE".

Return only the location name or "NONE":`,
            temperature: 0.1,
            maxTokens: 50,
        })

        const matchedName = result.text.trim()

        if (matchedName === "NONE") {
            console.warn(`⚠️  No matching PropertyLocation found for: "${locationText}"`)
            console.warn(`⚠️  Consider adding "${searchTerm}" to PropertyLocation table`)
            return null
        }

        // Find the matched location
        const matched = allLocations.find(l => l.name.toLowerCase() === matchedName.toLowerCase())

        if (matched) {
            console.log(`✅ AI matched: "${searchTerm}" → "${matched.name}" (${matched.id})`)
            return matched.id
        }

        console.warn(`⚠️  AI returned invalid location name: "${matchedName}"`)
        return null
    } catch (error) {
        console.error(`❌ Failed to map property location: "${locationText}"`, error.message)
        return null
    }
}

/**
 * Clears the geocode cache
 * Useful for testing or when cache becomes too large
 */
export function clearGeocodeCache() {
    geocodeCache.clear()
    console.log("🗑️  Geocode cache cleared")
}

/**
 * Gets cache statistics
 * @returns {{size: number, entries: number}} Cache stats
 */
export function getGeocodeStats() {
    return {
        size: geocodeCache.size,
        entries: geocodeCache.size,
    }
}
