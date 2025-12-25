import { openai } from "@ai-sdk/openai"
import { generateText } from "ai"

/**
 * AI-based data normalization module
 * Uses AI SDK v6 to normalize and structure property data
 */

// Rate limiting configuration
let lastAiCallTime = 0
const MIN_DELAY_BETWEEN_CALLS = 100 // 100ms between calls

/**
 * Rate limiter - ensures minimum delay between AI API calls
 * @returns {Promise<void>}
 */
async function rateLimit() {
    const now = Date.now()
    const timeSinceLastCall = now - lastAiCallTime

    if (timeSinceLastCall < MIN_DELAY_BETWEEN_CALLS) {
        const delay = MIN_DELAY_BETWEEN_CALLS - timeSinceLastCall
        await new Promise(resolve => setTimeout(resolve, delay))
    }

    lastAiCallTime = Date.now()
}

/**
 * Generic AI call wrapper with retry logic
 * @param {Function} aiFunction - Async function that makes AI call
 * @param {string} context - Context for error messages
 * @returns {Promise<any>} AI response
 */
async function callAiWithRetry(aiFunction, context) {
    const maxRetries = 2

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await rateLimit()
            return await aiFunction()
        } catch (error) {
            const isLastAttempt = attempt === maxRetries

            if (isLastAttempt) {
                console.error(`❌ AI API call failed for ${context} after ${maxRetries} attempts:`, error.message)
                throw error
            }

            console.warn(`⚠️  AI API call failed for ${context} (attempt ${attempt}/${maxRetries}), retrying...`)
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
        }
    }
}

// ============================================================================
// PHASE 4.2: PRICE AND MEASUREMENT EXTRACTION
// ============================================================================

/**
 * Extracts numeric values from text using AI
 * @param {string} text - Text containing numeric value (e.g., "550 ЕУР / месечно")
 * @param {string} field - Field name for context (e.g., "price", "area")
 * @returns {Promise<number|null>} Extracted numeric value or null
 */
export async function extractNumericValue(text, field) {
    if (!text) return null

    try {
        const result = await callAiWithRetry(async () => {
            const { text: response } = await generateText({
                model: openai("gpt-4o-mini"),
                prompt: `Extract the numeric value from the following ${field} text. Return ONLY the number without any currency symbols, units, or additional text. If you cannot extract a number, return "null".
                ${field} text: "${text}"
                    Examples:
                    - "550 ЕУР / месечно" → 550
                    - "62 m2" → 62
                    - "1,200 EUR" → 1200
                    - "не е наведена" → null

                Return only the number or the word "null":`,
                temperature: 0.1,
                maxTokens: 50,
            })
            return response
        }, `extractNumericValue(${field})`)

        const trimmed = result.trim()

        if (trimmed === "null" || trimmed === "") {
            console.warn(`⚠️  Could not extract ${field} from: "${text}"`)
            return null
        }

        const parsed = parseInt(trimmed, 10)

        if (isNaN(parsed)) {
            console.warn(`⚠️  Invalid ${field} value: "${trimmed}" from text: "${text}"`)
            return null
        }

        return parsed
    } catch (error) {
        console.error(`❌ Failed to extract ${field} from: "${text}"`, error.message)
        return null
    }
}

// ============================================================================
// PHASE 4.3: ENUM VALUE MAPPING
// ============================================================================

/**
 * Maps listing type text to PropertyListingType enum
 * @param {string} text - Listing type text (e.g., "Се изнајмува", "Се продава")
 * @returns {Promise<string>} PropertyListingType enum value ("for_rent" or "for_sale")
 */
export async function mapListingType(text) {
    if (!text) throw new Error("Listing type text is required")

    const lowerText = text.toLowerCase().trim()

    if (lowerText.includes("изнајм") || lowerText.includes("rent") || lowerText.includes("наем")) return "for_rent"
    if (lowerText.includes("продав") || lowerText.includes("sale") || lowerText.includes("sell")) return "for_sale"

    try {
        const result = await callAiWithRetry(async () => {
            const { text: response } = await generateText({
                model: openai("gpt-4o-mini"),
                temperature: 0.1,
                maxTokens: 20,
                prompt: `Classify the following property listing type text into one of these categories:
                        - for_rent (properties for rent/lease)
                        - for_sale (properties for sale)
                           Listing type text: "${text}"
                         
                            Common Macedonian patterns:
                            - "Се изнајмува" / "За изнајмување" → for_rent
                            - "Се продава" / "За продажба" → for_sale
                            
                            Return ONLY one of: for_rent, for_sale`,
            })
            return response
        }, "mapListingType")

        const mapped = result.trim().toLowerCase()
        if (mapped === "for_rent" || mapped === "for_sale") return mapped

        throw new Error(`Invalid listing type returned: ${mapped}`)
    } catch (error) {
        console.error(`❌ Failed to map listing type: "${text}"`, error.message)
        // Default to for_sale if uncertain
        console.warn(`⚠️  Defaulting to "for_sale" for: "${text}"`)
        return "for_sale"
    }
}

/**
 * Classifies property type from title and description
 * @param {string} title - Property title
 * @param {string} description - Property description
 * @returns {Promise<{type: string, confidence: number}>} PropertyType enum value and confidence score
 */
export async function classifyPropertyType(title, description) {
    if (!title && !description) {
        throw new Error("At least title or description is required for classification")
    }

    try {
        const result = await callAiWithRetry(async () => {
            const { text: response } = await generateText({
                model: openai("gpt-4o-mini"),
                temperature: 0.2,
                maxTokens: 100,
                prompt: `Classify the following property into ONE of these types:
                        - flat (apartments, studios, penthouses)
                        - house (single-family homes, villas, townhouses)
                        - land (plots, parcels, agricultural land)
                        - holiday_home (vacation homes, cottages)
                        - garage (parking spaces, garages)
                        - commercial (offices, shops, warehouses, business spaces)
                        
                        Property title: "${title || "N/A"}"
                        Property description: "${description || "N/A"}"
                        
                        Common Macedonian keywords:
                        - Стан, Апартман → flat
                        - Куќа, Вила → house
                        - Земјиште, Плац → land
                        - Викендица → holiday_home
                        - Гаража, Паркинг → garage
                        - Деловен простор, Канцеларија, Локал → commercial
                        
                        Return your response in this exact format:
                        type: <property_type>
                        confidence: <0.0-1.0>
                        
                        Example:
                        type: flat
                        confidence: 0.95`,
            })
            return response
        }, "classifyPropertyType")

        const lines = result.trim().split("\n")
        const typeLine = lines.find(l => l.startsWith("type:"))
        const confidenceLine = lines.find(l => l.startsWith("confidence:"))

        if (!typeLine) throw new Error("Could not parse property type from AI response")

        const type = typeLine.replace("type:", "").trim()
        const confidence = confidenceLine ? parseFloat(confidenceLine.replace("confidence:", "").trim()) : 0.5

        const validTypes = ["flat", "house", "land", "holiday_home", "garage", "commercial"]
        if (!validTypes.includes(type)) throw new Error(`Invalid property type returned: ${type}`)

        if (confidence < 0.7)
            console.warn(`⚠️  Low confidence (${confidence}) classification for property: "${title}" → ${type}`)

        return { type, confidence }
    } catch (error) {
        console.error(`❌ Failed to classify property type for: "${title}"`, error.message)
        // Default to flat as it's the most common type
        console.warn(`⚠️  Defaulting to "flat" for: "${title}"`)
        return { type: "flat", confidence: 0.0 }
    }
}

// ============================================================================
// PHASE 4.4: JSON FIELD STRUCTURING
// ============================================================================

/**
 * Structures name/title into multilingual JSON
 * @param {string} title - Property title
 * @returns {Promise<{mk: string, en: string|null}>} Structured name object
 */
export async function structureName(title) {
    if (!title) {
        throw new Error("Title is required")
    }

    try {
        const result = await callAiWithRetry(async () => {
            const { text: response } = await generateText({
                model: openai("gpt-4o-mini"),
                prompt: `You are translating property titles. Detect the language and provide both Macedonian and English versions.

Property title: "${title}"

Instructions:
1. If the title is in Macedonian, keep it as "mk" and translate to English as "en"
2. If the title is in English, keep it as "en" and translate to Macedonian as "mk"
3. If the title is in another language, translate to both Macedonian and English
4. Keep the translation professional and suitable for real estate listings
5. Preserve any numbers, measurements, or specific details

Return your response in this exact JSON format (no markdown, no extra text):
{"mk": "macedonian text", "en": "english text"}

If translation is not possible for one language, use null:
{"mk": "macedonian text", "en": null}`,
                temperature: 0.3,
                maxTokens: 200,
            })
            return response
        }, "structureName")

        // Parse JSON response
        const jsonMatch = result.match(/\{[^}]+\}/)
        if (!jsonMatch) {
            throw new Error("Could not parse JSON from AI response")
        }

        const parsed = JSON.parse(jsonMatch[0])

        // Validate structure
        if (!parsed.mk && !parsed.en) {
            throw new Error("Both mk and en are missing")
        }

        return {
            mk: parsed.mk || title, // Fallback to original if mk is missing
            en: parsed.en || null,
        }
    } catch (error) {
        console.error(`❌ Failed to structure name: "${title}"`, error.message)
        // Fallback: assume title is in Macedonian
        return {
            mk: title,
            en: null,
        }
    }
}

/**
 * Structures description into multilingual JSON
 * @param {string} description - Property description
 * @returns {Promise<{mk: string, en: string|null}>} Structured description object
 */
export async function structureDescription(description) {
    if (!description) {
        return { mk: "", en: null }
    }

    try {
        const result = await callAiWithRetry(async () => {
            const { text: response } = await generateText({
                model: openai("gpt-4o-mini"),
                prompt: `You are translating property descriptions. Detect the language and provide both Macedonian and English versions.

Property description: "${description}"

Instructions:
1. If the description is in Macedonian, keep it as "mk" and translate to English as "en"
2. If the description is in English, keep it as "en" and translate to Macedonian as "mk"
3. If the description is in another language, translate to both Macedonian and English
4. Preserve formatting, line breaks, and structure where possible
5. Keep the translation professional and suitable for real estate listings
6. Preserve any numbers, measurements, addresses, or specific details

Return your response in this exact JSON format (no markdown, no extra text):
{"mk": "macedonian text", "en": "english text"}

If translation is not possible for one language, use null:
{"mk": "macedonian text", "en": null}`,
                temperature: 0.3,
                maxTokens: 800,
            })
            return response
        }, "structureDescription")

        // Parse JSON response
        const jsonMatch = result.match(/\{[\s\S]+\}/)
        if (!jsonMatch) {
            throw new Error("Could not parse JSON from AI response")
        }

        const parsed = JSON.parse(jsonMatch[0])

        return {
            mk: parsed.mk || description,
            en: parsed.en || null,
        }
    } catch (error) {
        console.error(`❌ Failed to structure description`, error.message)
        // Fallback: assume description is in Macedonian
        return {
            mk: description,
            en: null,
        }
    }
}

/**
 * Extracts and structures property attributes from source data
 * @param {Object} sourceData - Raw property data from external source
 * @returns {Promise<Object>} Structured attributes JSON
 */
export async function extractAttributes(sourceData) {
    try {
        const features = sourceData.features || []
        const description = sourceData.description || ""
        const title = sourceData.title || ""

        const result = await callAiWithRetry(async () => {
            const { text: response } = await generateText({
                model: openai("gpt-4o-mini"),
                temperature: 0.2,
                maxTokens: 300,
                prompt: `Extract property attributes from the following data and return a structured JSON object.
                            Property title: "${title}"
                            Property description: "${description}"
                            Features: ${JSON.stringify(features)}

                            Extract the following attributes if mentioned:
                            - hasBalcony (boolean): does it have a balcony/terrace?
                            - hasElevator (boolean): does it have an elevator/lift?
                            - hasParking (boolean): does it have parking space?
                            - hasCentralHeating (boolean): does it have central heating?
                            - hasAirConditioning (boolean): does it have air conditioning?
                            - floor (number): which floor is it on?
                            - totalFloors (number): total number of floors in the building
                            - bedrooms (number): number of bedrooms
                            - bathrooms (number): number of bathrooms
                            - furnished (boolean): is it furnished?
                            - petFriendly (boolean): are pets allowed?
                            - hasGarden (boolean): does it have a garden?
                            - hasBasement (boolean): does it have a basement?
                            
                            Common Macedonian keywords:
                            - Балкон/Тераса → hasBalcony
                            - Лифт → hasElevator
                            - Паркинг → hasParking
                            - Централно греење → hasCentralHeating
                            - Клима → hasAirConditioning
                            - Спрат → floor
                            - Намештен → furnished
                            - Градина → hasGarden

                            Return ONLY a JSON object with the extracted attributes (only include attributes that are found):
                            {"hasBalcony": true, "floor": 3, "bedrooms": 2}

                            If no attributes found, return: {}`,
            })
            return response
        }, "extractAttributes")

        const jsonMatch = result.match(/\{[^}]*\}/)
        if (!jsonMatch) {
            console.warn("⚠️  No attributes extracted")
            return {}
        }

        return JSON.parse(jsonMatch[0])
    } catch (error) {
        console.error(`❌ Failed to extract attributes`, error.message)
        return {}
    }
}
