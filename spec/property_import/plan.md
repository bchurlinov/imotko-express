# Implementation Plan: Property Import Feature

## Overview

This implementation plan details the technical approach to building the automated property import system. Each plan item is linked to the corresponding requirements and assigned a priority.

---

## Phase 1: Foundation and Setup

### 1.1 Environment and Dependencies Setup
**Priority:** High
**Related Requirements:** REQ-12 (Configuration and Environment)

- Install required npm packages:
  - `@supabase/supabase-js` (verify already installed)
  - `sharp` for image processing
  - `uuid` for unique ID generation
  - AI SDK v6 (`ai`, `@ai-sdk/openai` or appropriate provider)
  - `dotenv` (verify already installed)
- Add environment variables to `.env`:
  - `IMPORT_DATA_SOURCE_URL` (default: https://globalracecalendar.com/imotko/delta.json)
  - `IMPORT_SYSTEM_USER_ID` (user ID for createdBy field)
  - `IMPORT_DEFAULT_AGENCY_ID` (optional)
  - `IMPORT_BATCH_SIZE` (default: 10)
  - `IMPORT_TEST_MODE` (default: false)
  - `AI_API_KEY` (for AI SDK)
  - Verify existing: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Update `.env.example` with new variables

### 1.2 System User and Agency Setup
**Priority:** High
**Related Requirements:** REQ-9 (System User and Agency Assignment)

- Create database seed/migration for system user if it doesn't exist
- Create default "Imported Listings" agency (optional)
- Document the user ID and agency ID in environment setup documentation

### 1.3 Create Job File Structure
**Priority:** High
**Related Requirements:** REQ-1 (External Data Fetching)

- Set up `src/jobs/import_properties.js` file structure
- Create helper modules:
  - `src/jobs/helpers/image_processor.js` - image download and upload logic
  - `src/jobs/helpers/ai_normalizer.js` - AI-based data normalization
  - `src/jobs/helpers/geocoder.js` - address geocoding
  - `src/jobs/helpers/property_mapper.js` - map source data to Property model
- Set up configuration loader for environment variables

---

## Phase 2: Core Data Fetching and Validation

### 2.1 Implement External API Fetching
**Priority:** High
**Related Requirements:** REQ-1 (External Data Fetching)

- Implement `fetchPropertiesFromAPI()` function
  - Use native `fetch()` or `axios` to retrieve JSON data
  - Add timeout configuration (30 seconds)
  - Implement error handling for network failures
  - Validate response status code
  - Parse JSON response
- Add retry logic (max 3 attempts) for transient failures
- Log fetch start, completion, and any errors

### 2.2 Data Structure Validation
**Priority:** High
**Related Requirements:** REQ-1 (External Data Fetching), REQ-8 (Database Storage)

- Implement `validateSourceData()` function
  - Check for required fields: title, images, price, location
  - Validate data types (arrays, strings, etc.)
  - Log validation errors with property index
  - Return validated and invalid property arrays separately
- Filter out invalid properties and log count

---

## Phase 3: Image Processing Pipeline

### 3.1 Image Download Module
**Priority:** High
**Related Requirements:** REQ-2 (Image Download and Processing)

- Implement `downloadImage(url)` function in `image_processor.js`
  - Use `fetch()` to download binary data
  - Handle different content types (jpeg, png, webp)
  - Implement timeout (15 seconds per image)
  - Return Buffer object
  - Handle 404s and other HTTP errors
- Add retry logic (max 3 attempts) with exponential backoff

### 3.2 Image Processing with Sharp
**Priority:** High
**Related Requirements:** REQ-2 (Image Download and Processing)

- Implement `processImage(imageBuffer)` function
  - Configure Sharp: `sharp.cache(false)`, `sharp.concurrency(1)`
  - Detect image format from buffer
  - Generate three size variants:
    - Small: 300px width, quality 60
    - Medium: 650px width, quality 60
    - Large: 900px width, quality 60
  - Apply format-specific compression:
    - PNG: compressionLevel 6, adaptiveFiltering false
    - JPEG: quality 60
    - WebP: quality 60
  - Return array of processed buffers with metadata

### 3.3 Supabase Upload Module
**Priority:** High
**Related Requirements:** REQ-3 (Supabase Storage Upload)

- Implement `uploadToSupabase(imageBuffer, metadata)` function
  - Initialize Supabase client with service role key
  - Generate unique filename: `{uuid}_{timestamp}-{size}.{extension}`
  - Upload to "imotko-prod" bucket with correct content type
  - Retrieve public URL after upload
  - Return object with size variant, storage key, and public URL
- Implement batch upload for all size variants
- Add retry logic (max 3 attempts) with exponential backoff
- Handle upload errors gracefully (log and continue)

### 3.4 Image Pipeline Orchestration
**Priority:** High
**Related Requirements:** REQ-2, REQ-3, REQ-11 (Batch Processing)

- Implement `processPropertyImages(imageUrls)` function
  - Limit concurrent downloads (max 3 at a time)
  - For each image URL:
    1. Download image
    2. Process with Sharp (generate 3 sizes)
    3. Upload all sizes to Supabase
    4. Collect public URLs
  - Generate photo JSON structure:
    ```json
    {
      "id": "uuid",
      "name": null,
      "sizes": {
        "small": "url",
        "medium": "url",
        "large": "url"
      },
      "s3Urls": ["key1", "key2", "key3"]
    }
    ```
  - Return array of photo objects
  - Log progress and errors for each image

---

## Phase 4: AI-Based Data Normalization

### 4.1 AI SDK Configuration
**Priority:** High
**Related Requirements:** REQ-4 (Data Normalization with AI), REQ-12 (Configuration)

- Set up AI SDK v6 with appropriate provider (OpenAI, Anthropic, etc.)
- Create AI client with API key from environment
- Define prompt templates for different normalization tasks
- Implement rate limiting and retry logic

### 4.2 Price and Measurement Extraction
**Priority:** High
**Related Requirements:** REQ-4 (Data Normalization with AI)

- Implement `extractNumericValue(text, field)` function using AI
  - Parse price strings (e.g., "550 ЕУР / месечно" → 550)
  - Parse area strings (e.g., "62 m2" → 62)
  - Handle various formats and currencies
  - Return integer value or null if extraction fails
  - Use AI to handle edge cases and variations

### 4.3 Enum Value Mapping
**Priority:** High
**Related Requirements:** REQ-4 (Data Normalization with AI)

- Implement `mapListingType(text)` function
  - Map "Се изнајмува" → `for_rent`
  - Map "Се продава" → `for_sale`
  - Handle variations and typos using AI
  - Return PropertyListingType enum value

- Implement `classifyPropertyType(title, description)` function
  - Analyze title and description with AI
  - Classify into: flat, house, land, holiday_home, garage, commercial
  - Return PropertyType enum value
  - Provide confidence score, log low-confidence classifications

### 4.4 JSON Field Structuring
**Priority:** Medium
**Related Requirements:** REQ-4, REQ-14 (Data Structure and JSON Fields)

- Implement `structureName(title)` function
  - Use AI to detect language
  - Structure as: `{ "mk": "macedonian", "en": "english" }`
  - If no translation available, duplicate or leave English null

- Implement `structureDescription(description)` function
  - Similar to name structuring
  - Preserve formatting where possible

- Implement `extractAttributes(sourceData)` function
  - Parse features array from source
  - Map to structured attributes object
  - Extract additional attributes from description using AI
  - Return JSON object for attributes field

### 4.5 Geocoding Implementation
**Priority:** High
**Related Requirements:** REQ-5 (Address Geocoding)

- Implement `geocodeAddress(location, address)` function in `geocoder.js`
  - Parse location and address fields
  - Use AI or external geocoding API (Google Maps, Nominatim)
  - Return latitude and longitude
  - Implement caching for identical locations
  - Handle geocoding failures with default coordinates or skip property
  - Log geocoding results and failures

### 4.6 Location Mapping
**Priority:** Medium
**Related Requirements:** REQ-6 (Property Location Mapping)

- Implement `mapPropertyLocation(locationText)` function
  - Parse location string (e.g., "Центар, Скопjе")
  - Query PropertyLocation table for matching records
  - Use AI to handle ambiguous matches
  - Return PropertyLocation ID
  - Log missing locations for manual creation

---

## Phase 5: Property Persistence and Duplicate Handling

### 5.1 External ID Generation
**Priority:** High
**Related Requirements:** REQ-7 (Duplicate Prevention)

- Implement `generateExternalId(propertyData)` function
  - Create consistent hash or ID from source data
  - Use combination of title, address, and source identifier
  - Ensure uniqueness and consistency across imports

### 5.2 Duplicate Detection
**Priority:** High
**Related Requirements:** REQ-7 (Duplicate Prevention), REQ-13 (Idempotency)

- Implement `checkDuplicate(externalId)` function
  - Query database for existing property with same externalId
  - Return existing property or null
  - Log duplicate detection

- Implement configurable behavior:
  - Skip duplicates (default)
  - Update existing properties (optional)

### 5.3 Property Data Mapping
**Priority:** High
**Related Requirements:** REQ-8 (Database Storage), REQ-14 (Data Structure)

- Implement `mapToPropertyModel(normalizedData)` function in `property_mapper.js`
  - Map all normalized fields to Property model fields
  - Set required fields:
    - `name` (Json)
    - `latitude` (Float)
    - `longitude` (Float)
    - `address` (String)
    - `price` (Int)
    - `size` (Int)
    - `description` (Json)
    - `createdBy` (from env)
    - `type` (PropertyType)
    - `listingType` (PropertyListingType)
  - Set optional fields:
    - `photos` (Json)
    - `attributes` (Json)
    - `agencyId` (from env if configured)
    - `propertyLocationId`
    - `externalId`
  - Set default values:
    - `status` = `PENDING`
    - `featured` = false
  - Validate required fields are present
  - Return property creation object

### 5.4 Database Insertion
**Priority:** High
**Related Requirements:** REQ-8 (Database Storage), REQ-13 (Idempotency)

- Implement `saveProperty(propertyData)` function
  - Use Prisma client from `@database/client.js`
  - Wrap in try-catch for error handling
  - Use database transaction for atomicity
  - Return created property or error
  - Log successful creation with property ID
  - Log failures with property data for debugging

---

## Phase 6: Orchestration and Job Execution

### 6.1 Main Import Function
**Priority:** High
**Related Requirements:** REQ-11 (Batch Processing), REQ-10 (Error Handling)

- Implement `importProperties()` main function in `src/jobs/import_properties.js`
  - Load configuration from environment
  - Initialize logging
  - Fetch properties from API
  - Validate source data
  - Process in batches (configurable size, default 10)
  - For each property in batch:
    1. Generate external ID
    2. Check for duplicates
    3. Process images
    4. Normalize data with AI
    5. Geocode address
    6. Map to Property model
    7. Save to database
  - Collect statistics: total, success, failed, skipped
  - Log summary on completion
  - Handle errors gracefully (continue processing)

### 6.2 Batch Processing Logic
**Priority:** High
**Related Requirements:** REQ-11 (Batch Processing and Performance)

- Implement batch iteration with controlled concurrency
  - Process batches sequentially
  - Within batch, process properties in parallel (with limits)
  - Wait for batch completion before starting next
  - Implement progress logging (e.g., "Processing batch 3/10")

### 6.3 Error Handling and Logging
**Priority:** High
**Related Requirements:** REQ-10 (Error Handling and Logging), REQ-13 (Retry Logic)

- Implement comprehensive logging throughout:
  - Job start: timestamp, configuration
  - Fetch: start, completion, errors
  - Per property: start processing, stage completions, errors
  - Batch: completion statistics
  - Job end: summary statistics, duration
- Use structured logging with property identifiers
- Implement error collection for final summary report
- Ensure errors don't stop entire job (continue processing)

### 6.4 Test Mode Implementation
**Priority:** Medium
**Related Requirements:** REQ-15 (Testing and Validation Mode)

- Implement test mode flag check
- When `IMPORT_TEST_MODE=true`:
  - Skip database saves
  - Log normalized data instead
  - Optionally skip image uploads (configurable)
  - Clearly log "TEST MODE" in all log output
  - Generate test report with would-be database insertions

---

## Phase 7: Cron Job Integration and Monitoring

### 7.1 Cron Job Setup
**Priority:** Medium
**Related Requirements:** REQ-1 (External Data Fetching)

- Configure cron schedule (e.g., daily at midnight)
- Use existing cron infrastructure or node-cron package
- Add job registration in application startup
- Implement graceful shutdown handling

### 7.2 Execution Monitoring
**Priority:** Low
**Related Requirements:** REQ-10 (Error Handling and Logging)

- Implement execution tracking:
  - Store last execution timestamp
  - Track consecutive failures
  - Alert on repeated failures (optional)
- Create admin endpoint to view import history (optional)
- Log retention and rotation strategy

---

## Phase 8: Testing and Documentation

### 8.1 Unit Tests
**Priority:** Medium
**Related Requirements:** All

- Write unit tests for key functions:
  - `downloadImage()`
  - `processImage()`
  - `uploadToSupabase()`
  - `extractNumericValue()`
  - `mapListingType()`
  - `classifyPropertyType()`
  - `geocodeAddress()`
  - `generateExternalId()`
  - `mapToPropertyModel()`
- Mock external dependencies (API, Supabase, AI SDK)

### 8.2 Integration Tests
**Priority:** Low
**Related Requirements:** All

- Test end-to-end flow with sample data
- Test error scenarios:
  - API unavailable
  - Image download failures
  - AI API failures
  - Database errors
- Verify duplicate handling
- Verify idempotency

### 8.3 Documentation
**Priority:** Medium
**Related Requirements:** REQ-12 (Configuration)

- Update README with:
  - Import job overview
  - Environment variable configuration
  - How to run manually
  - How to enable test mode
  - Troubleshooting guide
- Document JSON field structures
- Document system user setup requirements
- Add inline code comments for complex logic

---

## Phase 9: Optimization and Refinement

### 9.1 Performance Optimization
**Priority:** Low
**Related Requirements:** REQ-11 (Batch Processing and Performance)

- Profile execution to identify bottlenecks
- Optimize image processing (parallel processing)
- Optimize database queries (batch inserts if possible)
- Implement better caching strategies
- Fine-tune batch sizes and concurrency limits

### 9.2 Error Recovery
**Priority:** Low
**Related Requirements:** REQ-13 (Idempotency and Retry Logic)

- Implement checkpoint/resume capability for long-running jobs
- Store partial progress to allow resumption after failures
- Add manual retry functionality for failed properties

### 9.3 Monitoring and Alerting
**Priority:** Low
**Related Requirements:** REQ-10 (Error Handling and Logging)

- Integrate with monitoring tools (if available)
- Set up alerts for high failure rates
- Create dashboard for import statistics (optional)

---

## Priority Summary

### High Priority (Must Have)
- All Phase 1 items (Foundation and Setup)
- All Phase 2 items (Core Data Fetching)
- All Phase 3 items (Image Processing Pipeline)
- All Phase 4 items except 4.4 (AI Normalization)
- All Phase 5 items (Property Persistence)
- Phase 6.1, 6.2, 6.3 (Job Execution and Error Handling)

### Medium Priority (Should Have)
- Phase 4.4 (JSON Field Structuring)
- Phase 5.2 update behavior (optional duplicate update)
- Phase 6.4 (Test Mode)
- Phase 7.1 (Cron Job Setup)
- Phase 8.1 (Unit Tests)
- Phase 8.3 (Documentation)

### Low Priority (Nice to Have)
- Phase 7.2 (Execution Monitoring)
- Phase 8.2 (Integration Tests)
- All Phase 9 items (Optimization and Refinement)

---

## Dependencies and Risks

### External Dependencies
- AI SDK v6 API availability and rate limits
- Supabase storage availability
- External data source reliability
- Geocoding API availability (if using external service)

### Technical Risks
- AI classification accuracy for property types
- Geocoding accuracy and coverage for Macedonian addresses
- Image processing memory usage for large properties
- External URL image availability (broken links, rate limiting)

### Mitigation Strategies
- Implement robust retry logic with exponential backoff
- Implement graceful degradation (skip properties with errors)
- Monitor resource usage and adjust batch sizes
- Implement caching for repeated operations
- Use test mode extensively before production deployment
