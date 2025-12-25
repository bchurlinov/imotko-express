import { importConfig } from "./config.js"
import prisma from "#database/client.js"
import { processPropertyImages } from "./helpers/image_processor.js"
import {
    extractNumericValue,
    mapListingType,
    classifyPropertyType,
    structureName,
    structureDescription,
    extractAttributes,
} from "./helpers/ai_normalizer.js"
import { geocodeAddress, mapPropertyLocation } from "./helpers/geocoder.js"
import { generateExternalId, checkDuplicate, mapToPropertyModel, saveProperty } from "./helpers/property_mapper.js"

/**
 * Main property import job
 * Fetches properties from external API and imports them into the database
 *
 * This job performs the following steps:
 * 1. Fetch properties from external data source
 * 2. Validate source data
 * 3. Process properties in batches
 * 4. For each property:
 *    - Generate external ID
 *    - Check for duplicates
 *    - Process images
 *    - Normalize data with AI
 *    - Geocode address
 *    - Map to Property model
 *    - Save to database
 * 5. Log summary statistics
 */

// ============================================================================
// PHASE 2: DATA FETCHING AND VALIDATION
// ============================================================================

/**
 * Fetches properties from external API with retry logic
 * @returns {Promise<Array<Object>>} Array of property objects from external source
 * @throws {Error} If all retry attempts fail
 */
async function fetchPropertiesFromAPI() {
    const maxRetries = 3
    const timeout = 30000 // 30 seconds
    const retryDelays = [1000, 2000, 4000] // Exponential backoff: 1s, 2s, 4s

    console.log(`📡 Fetching data from: ${importConfig.dataSourceUrl}`)

    for (const [index, delay] of retryDelays.entries()) {
        const attempt = index + 1
        const isLastAttempt = attempt === maxRetries

        try {
            console.log(`⏳ Attempt ${attempt}/${maxRetries}...`)

            // Create AbortController for timeout
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), timeout)

            const response = await fetch(importConfig.dataSourceUrl, {
                signal: controller.signal,
                headers: {
                    "User-Agent": "Imotko-Property-Import/1.0",
                    Accept: "application/json",
                },
            })

            clearTimeout(timeoutId)

            // Validate response status
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`)

            // Parse JSON response
            const data = await response.json()

            // Validate response structure
            if (!Array.isArray(data)) throw new Error(`Invalid response format: expected array, got ${typeof data}`)

            console.log(`✅ Successfully fetched ${data.length} properties`)
            console.log(`📦 Response size: ${(JSON.stringify(data).length / 1024).toFixed(2)} KB`)

            return data
        } catch (error) {
            // Handle different error types
            if (error.name === "AbortError") {
                console.error(`⏱️  Request timeout after ${timeout / 1000}s (attempt ${attempt}/${maxRetries})`)
            } else if (error.code === "ENOTFOUND") {
                console.error(`🌐 DNS lookup failed - unable to resolve hostname (attempt ${attempt}/${maxRetries})`)
            } else if (error.code === "ECONNREFUSED") {
                console.error(`🔌 Connection refused by server (attempt ${attempt}/${maxRetries})`)
            } else {
                console.error(`❌ Fetch error (attempt ${attempt}/${maxRetries}): ${error.message}`)
            }

            // If this is the last attempt, throw the error
            if (isLastAttempt)
                throw new Error(`Failed to fetch properties after ${maxRetries} attempts: ${error.message}`)

            // Wait before retrying (exponential backoff)
            console.log(`⏳ Retrying in ${delay / 1000}s...`)
            await new Promise(resolve => setTimeout(resolve, delay))
        }
    }
}

/**
 * Validates source property data structure and required fields
 * @param {Array<Object>} properties - Array of property objects from external source
 * @returns {{valid: Array<Object>, invalid: Array<Object>}} Separated valid and invalid properties
 */
function validateSourceData(properties) {
    console.log(`🔍 Validating ${properties.length} properties...`)

    const valid = []
    const invalid = []
    const validationErrors = []

    properties.forEach((property, index) => {
        const errors = []

        // Check required field: title
        if (!property.title || typeof property.title !== "string") {
            errors.push("Missing or invalid 'title' field")
        }

        // Check required field: images (must be array)
        if (!property.images || !Array.isArray(property.images)) {
            errors.push("Missing or invalid 'images' field (expected array)")
        } else if (property.images.length === 0) {
            errors.push("'images' array is empty")
        }

        // Check required field: price
        if (!property.price || typeof property.price !== "string") {
            errors.push("Missing or invalid 'price' field")
        }

        // Check required field: location
        if (!property.location || typeof property.location !== "string") {
            errors.push("Missing or invalid 'location' field")
        }

        // Additional data type validations
        if (property.description && typeof property.description !== "string") {
            errors.push("Invalid 'description' field (expected string)")
        }

        if (property.area && typeof property.area !== "string") {
            errors.push("Invalid 'area' field (expected string)")
        }

        if (property.features && !Array.isArray(property.features)) {
            errors.push("Invalid 'features' field (expected array)")
        }

        if (property.listingType && typeof property.listingType !== "string") {
            errors.push("Invalid 'listingType' field (expected string)")
        }

        // Categorize property
        if (errors.length > 0) {
            invalid.push(property)
            validationErrors.push({
                index,
                title: property.title || "Unknown",
                errors,
            })
        } else {
            valid.push(property)
        }
    })

    // Log validation results
    console.log(`✅ Valid properties: ${valid.length}`)
    console.log(`❌ Invalid properties: ${invalid.length}`)

    // Log details of invalid properties
    if (validationErrors.length > 0) {
        console.log(`\n⚠️  Validation errors found:`)
        validationErrors.slice(0, 10).forEach(err => {
            console.log(`  Property #${err.index} ("${err.title}"): ${err.errors.join(", ")}`)
        })

        if (validationErrors.length > 10) {
            console.log(`  ... and ${validationErrors.length - 10} more validation errors`)
        }
        console.log("")
    }

    return { valid, invalid }
}

// ============================================================================
// PHASE 7: EXECUTION TRACKING
// ============================================================================

/**
 * Helper function to update execution record in database
 * Task 7.2.2, 7.2.3: Store execution data and track failures
 * @param {string} executionId - Execution record ID
 * @param {Object} data - Data to update
 */
async function updateExecutionRecord(executionId, data) {
    try {
        // Task 7.2.3: Track consecutive failures
        if (data.status === "FAILED") {
            // Get the last execution to calculate consecutive failures
            const lastExecution = await prisma.importJobExecution.findFirst({
                where: {
                    id: { not: executionId },
                    jobName: "property_import",
                },
                orderBy: {
                    startedAt: "desc",
                },
                select: {
                    consecutiveFailures: true,
                    status: true,
                },
            })

            // Increment consecutive failures if last job also failed
            data.consecutiveFailures =
                lastExecution && lastExecution.status === "FAILED" ? lastExecution.consecutiveFailures + 1 : 1
        } else if (data.status === "SUCCESS" || data.status === "PARTIAL") {
            // Reset consecutive failures on success
            data.consecutiveFailures = 0
        }

        await prisma.importJobExecution.update({
            where: { id: executionId },
            data: data,
        })

        // Task 7.2.4: Alert on repeated failures (optional)
        if (
            data.consecutiveFailures &&
            data.consecutiveFailures >= parseInt(process.env.IMPORT_ALERT_THRESHOLD || "3", 10)
        ) {
            console.error(
                `\n${"🚨".repeat(20)}\n🚨 ALERT: ${data.consecutiveFailures} consecutive import job failures!\n${"🚨".repeat(20)}\n`
            )
            // TODO: Implement email/Slack notification here
        }
    } catch (error) {
        console.error("❌ Failed to update execution record:", error.message)
    }
}

// ============================================================================
// PHASE 6: ORCHESTRATION AND JOB EXECUTION
// ============================================================================

/**
 * Processes a single property through the full import pipeline
 * @param {Object} sourceProperty - Property data from external source
 * @param {Object} stats - Statistics object to update
 * @param {number} index - Property index for logging
 * @param {number} total - Total properties for logging
 * @returns {Promise<void>}
 */
async function processSingleProperty(sourceProperty, stats, index, total) {
    const logPrefix = `[${index + 1}/${total}]`
    const testModePrefix = importConfig.testMode ? "[TEST MODE] " : ""

    try {
        console.log(`\n${testModePrefix}${logPrefix} 🏠 Processing: "${sourceProperty.title}"`)
        console.log(`${logPrefix} 🔑 Generating external ID...`)
        const externalId = generateExternalId(sourceProperty)
        console.log(`${logPrefix} 🔍 Checking for duplicates...`)
        const duplicate = await checkDuplicate(externalId)

        if (duplicate) {
            console.log(`${logPrefix} ⏭️  Skipping duplicate property (DB ID: ${duplicate.id})`)
            stats.skipped++
            return
        }

        // Step 3: Process images

        // const photos =
        //     importConfig.testMode && process.env.IMPORT_TEST_SKIP_IMAGES === "true"
        //         ? []
        //         : await processPropertyImages(sourceProperty.images || [])

        const photos = []

        const price = await extractNumericValue(sourceProperty.price, "price")
        const size = await extractNumericValue(sourceProperty.area, "area")

        const listingType = await mapListingType(sourceProperty.listingType || "for_sale")
        const { type: propertyType } = await classifyPropertyType(sourceProperty.title, sourceProperty.description)

        const name = await structureName(sourceProperty.title)
        const description = await structureDescription(sourceProperty.description || "")

        const attributes = await extractAttributes(sourceProperty)

        const coordinates = await geocodeAddress(sourceProperty.location, sourceProperty.address || "")
        const propertyLocationId = await mapPropertyLocation(sourceProperty.location)

        const normalizedData = {
            name,
            description,
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
            address: sourceProperty.address || sourceProperty.location,
            price,
            size,
            type: propertyType,
            listingType,
            photos,
            attributes,
            propertyLocationId,
            externalId,
        }

        if (!price || !size)
            throw new Error(`Missing required fields: ${!price ? "price" : ""} ${!size ? "size" : ""}`.trim())

        const propertyData = mapToPropertyModel(normalizedData)
        if (importConfig.testMode) {
            console.log(`${logPrefix} 🧪 [TEST MODE] Would save property:`)
            console.log(
                JSON.stringify(
                    {
                        ...propertyData,
                        photos: `[${photos.length} photos]`,
                        attributes: JSON.stringify(attributes),
                    },
                    null,
                    2
                )
            )
            stats.success++
        } else {
            console.log(`${logPrefix} 💾 Saving to database...`)
            const createdProperty = await saveProperty(propertyData)
            console.log(`${logPrefix} ✅ Successfully imported property (ID: ${createdProperty.id})`)
            stats.success++
        }
    } catch (error) {
        console.error(`${testModePrefix}${logPrefix} ❌ Failed to process property: "${sourceProperty.title}"`)
        console.error(`${logPrefix}    Error: ${error.message}`)

        stats.failed++
        stats.errors.push({
            type: "PROPERTY_PROCESSING_ERROR",
            property: sourceProperty.title,
            message: error.message,
            stack: error.stack,
        })

        // Continue processing other properties (don't throw)
    }
}

/**
 * Processes properties in batches
 * @param {Array<Object>} properties - Valid properties to process
 * @param {Object} stats - Statistics object to update
 * @returns {Promise<void>}
 */
async function processBatches(properties, stats) {
    const batchSize = importConfig.batchSize
    const totalBatches = Math.ceil(properties.length / batchSize)

    const batches = []
    for (let i = 0; i < properties.length; i += batchSize) {
        batches.push(properties.slice(i, i + batchSize))
    }

    // Task 6.2.1, 6.2.2: Process batches sequentially
    for (const [batchIndex, batch] of batches.entries()) {
        const batchNumber = batchIndex + 1
        const batchStartIndex = batchIndex * batchSize

        const batchStartTime = Date.now()
        for (const [propertyIndex, property] of batch.entries()) {
            const globalIndex = batchStartIndex + propertyIndex
            await processSingleProperty(property, stats, globalIndex, properties.length)
        }

        const batchDuration = ((Date.now() - batchStartTime) / 1000).toFixed(2)
        console.log(`\n${"=".repeat(60)}`)
        console.log(`✅ BATCH ${batchNumber}/${totalBatches} COMPLETE (${batchDuration}s)`)
        console.log(`   Successful: ${stats.success}`)
        console.log(`   Skipped: ${stats.skipped}`)
        console.log(`   Failed: ${stats.failed}`)
        console.log(`${"=".repeat(60)}`)

        // Small delay between batches to avoid rate limiting
        if (batchNumber < totalBatches) {
            console.log(`⏸️  Waiting 2s before next batch...`)
            await new Promise(resolve => setTimeout(resolve, 2000))
        }
    }
}

/**
 * Main property import function with execution tracking
 * @param   {string} triggeredBy - Who triggered the job ("cron", "manual", "api")
 * @returns {Promise<Object>} Import results and execution record
 */
export async function importProperties(triggeredBy = "manual") {
    let executionRecord = null

    const stats = {
        total: 0,
        success: 0,
        failed: 0,
        skipped: 0,
        errors: [],
    }

    const startTime = Date.now()

    try {
        const properties = await fetchPropertiesFromAPI()
        stats.total = properties.length

        const { valid, invalid } = validateSourceData(properties)
        stats.failed = invalid.length

        // Check if we have any valid properties to process
        if (valid.length === 0) {
            console.log("⚠️  No valid properties to import")
            return
        }

        console.log("VALID PROPERTIES:", valids)

        await processBatches([valid?.at(0)], stats)
    } catch (error) {
        // Task 6.3.8: Ensure errors don't stop entire job
        console.error("❌ Fatal error during import:", error)
        stats.errors.push({
            type: "FATAL",
            message: error.message,
            stack: error.stack,
        })

        // Update execution record as failed
        if (executionRecord) {
            await updateExecutionRecord(executionRecord.id, {
                status: "FAILED",
                lastError: error.message,
                completedAt: new Date(),
                durationMs: Date.now() - startTime,
                errors: stats.errors,
            })
        }
    } finally {
        // Calculate duration
        const duration = Date.now() - startTime
        const durationSeconds = (duration / 1000).toFixed(2)

        // Task 6.3.6: Log job end with summary statistics and duration
        // Task 6.4.6: Generate test report summary
        const testModeHeader = importConfig.testMode ? " [TEST MODE]" : ""

        console.log("\n" + "=".repeat(50))
        console.log(`📊 IMPORT JOB SUMMARY${testModeHeader}`)
        console.log("=".repeat(50))
        console.log(`⏱️  Duration: ${durationSeconds}s`)
        console.log(`📝 Total properties fetched: ${stats.total}`)
        console.log(`✅ Successfully ${importConfig.testMode ? "processed" : "imported"}: ${stats.success}`)
        console.log(`⏭️  Skipped (duplicates): ${stats.skipped}`)
        console.log(`❌ Failed: ${stats.failed}`)

        // Task 6.3.7: Collect errors in array for final summary report
        if (stats.errors.length > 0) {
            console.log(`\n⚠️  Errors encountered: ${stats.errors.length}`)
            stats.errors.slice(0, 5).forEach((err, idx) => {
                console.log(`  ${idx + 1}. ${err.type}: ${err.message}`)
                if (err.property) {
                    console.log(`     Property: "${err.property}"`)
                }
            })
            if (stats.errors.length > 5) {
                console.log(`  ... and ${stats.errors.length - 5} more errors`)
            }
        }

        if (importConfig.testMode) {
            console.log("\n" + "⚠️ ".repeat(20))
            console.log("⚠️  TEST MODE - No actual data was saved to the database")
            console.log("⚠️ ".repeat(20))
        }

        console.log("=".repeat(50))
        console.log(`🏁 Job completed at: ${new Date().toISOString()}`)

        // Task 7.2.2: Store execution results in database
        if (executionRecord) {
            // Determine final status
            let finalStatus = "SUCCESS"
            let lastError = null

            if (stats.failed > 0 && stats.success === 0) {
                finalStatus = "FAILED"
                lastError = stats.errors.length > 0 ? stats.errors[0].message : "All properties failed to import"
            } else if (stats.failed > 0 && stats.success > 0) {
                finalStatus = "PARTIAL"
                lastError = `${stats.failed} properties failed to import`
            }

            try {
                await updateExecutionRecord(executionRecord.id, {
                    status: finalStatus,
                    completedAt: new Date(),
                    durationMs: duration,
                    totalProperties: stats.total,
                    successCount: stats.success,
                    failedCount: stats.failed,
                    skippedCount: stats.skipped,
                    errors: stats.errors.length > 0 ? stats.errors : null,
                    lastError: lastError,
                })

                console.log(`\n📊 Execution record saved (ID: ${executionRecord.id}, Status: ${finalStatus})`)
            } catch (error) {
                console.error("❌ Failed to save execution record:", error.message)
            }
        }

        // Disconnect from database
        await prisma.$disconnect()

        // Return results for manual triggers
        return {
            executionId: executionRecord?.id,
            stats: stats,
            duration: duration,
            status: stats.failed > 0 && stats.success === 0 ? "FAILED" : stats.failed > 0 ? "PARTIAL" : "SUCCESS",
        }
    }
}

// If running directly (not imported as module)
if (import.meta.url === `file://${process.argv[1]}`) {
    importProperties().catch(error => {
        console.error("❌ Unhandled error:", error)
        process.exit(1)
    })
}
