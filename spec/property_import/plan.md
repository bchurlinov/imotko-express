# Implementation Plan: Property Import Feature

## Overview

This implementation plan details the technical approach to building the automated property import system. Each plan item is linked to the corresponding requirements and assigned a priority.

---

## Phase 1: Foundation and Setup ✅

### 1.1 Environment and Dependencies Setup ✅

**Priority:** High
**Related Requirements:** REQ-12 (Configuration and Environment)

- [x] Install required npm packages:
    - [x] `@supabase/supabase-js` (verify already installed)
    - [x] `sharp` for image processing
    - [x] `uuid` for unique ID generation
    - [x] AI SDK v6 (`ai`, `@ai-sdk/openai` or appropriate provider)
    - [x] `dotenv` (verify already installed)
- [x] Add environment variables to `.env`:
    - [x] `IMPORT_DATA_SOURCE_URL` (default: https://globalracecalendar.com/imotko/delta.json)
    - [x] `IMPORT_SYSTEM_USER_ID` (user ID for createdBy field)
    - [x] `IMPORT_DEFAULT_AGENCY_ID` (optional)
    - [x] `IMPORT_BATCH_SIZE` (default: 10)
    - [x] `IMPORT_TEST_MODE` (default: false)
    - [x] `AI_API_KEY` (for AI SDK) - using existing OPENAI_API_KEY
    - [x] Verify existing: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- [x] Update `.env.example` with new variables

### 1.2 System User and Agency Setup ✅

**Priority:** High
**Related Requirements:** REQ-9 (System User and Agency Assignment)

- [x] Create database seed/migration for system user if it doesn't exist
- [x] Create default "Imported Listings" agency (optional)
- [x] Document the user ID and agency ID in environment setup documentation

### 1.3 Create Job File Structure ✅

**Priority:** High
**Related Requirements:** REQ-1 (External Data Fetching)

- [x] Set up `src/jobs/import_properties.js` file structure
- [x] Create helper modules:
    - [x] `src/jobs/helpers/image_processor.js` - image download and upload logic
    - [x] `src/jobs/helpers/ai_normalizer.js` - AI-based data normalization
    - [x] `src/jobs/helpers/geocoder.js` - address geocoding
    - [x] `src/jobs/helpers/property_mapper.js` - map source data to Property model
- [x] Set up configuration loader for environment variables

---

## Phase 2: Core Data Fetching and Validation ✅

### 2.1 Implement External API Fetching ✅

**Priority:** High
**Related Requirements:** REQ-1 (External Data Fetching)

- [x] Implement `fetchPropertiesFromAPI()` function
    - [x] Use native `fetch()` to retrieve JSON data
    - [x] Add timeout configuration (30 seconds)
    - [x] Implement error handling for network failures
    - [x] Validate response status code
    - [x] Parse JSON response
- [x] Add retry logic (max 3 attempts) for transient failures
- [x] Log fetch start, completion, and any errors

### 2.2 Data Structure Validation ✅

**Priority:** High
**Related Requirements:** REQ-1 (External Data Fetching), REQ-8 (Database Storage)

- [x] Implement `validateSourceData()` function
    - [x] Check for required fields: title, images, price, location
    - [x] Validate data types (arrays, strings, etc.)
    - [x] Log validation errors with property index
    - [x] Return validated and invalid property arrays separately
- [x] Filter out invalid properties and log count

---

## Phase 3: Image Processing Pipeline ✅

### 3.1 Image Download Module ✅

**Priority:** High
**Related Requirements:** REQ-2 (Image Download and Processing)

- [x] Implement `downloadImage(url)` function in `image_processor.js`
    - [x] Use `fetch()` to download binary data
    - [x] Handle different content types (jpeg, png, webp)
    - [x] Implement timeout (15 seconds per image)
    - [x] Return Buffer object
    - [x] Handle 404s and other HTTP errors
- [x] Add retry logic (max 3 attempts) with exponential backoff

### 3.2 Image Processing with Sharp ✅

**Priority:** High
**Related Requirements:** REQ-2 (Image Download and Processing)

- [x] Implement `processImage(imageBuffer)` function
    - [x] Configure Sharp: `sharp.cache(false)`, `sharp.concurrency(1)`
    - [x] Detect image format from buffer
    - [x] Generate three size variants:
        - [x] Small: 300px width, quality 60
        - [x] Medium: 650px width, quality 60
        - [x] Large: 900px width, quality 60
    - [x] Apply format-specific compression:
        - [x] PNG: compressionLevel 6, adaptiveFiltering false
        - [x] JPEG: quality 60
        - [x] WebP: quality 60
    - [x] Return array of processed buffers with metadata

### 3.3 Supabase Upload Module ✅

**Priority:** High
**Related Requirements:** REQ-3 (Supabase Storage Upload)

- [x] Implement `uploadToSupabase(imageBuffer, metadata)` function
    - [x] Initialize Supabase client with service role key
    - [x] Generate unique filename: `{uuid}_{timestamp}-{size}.{extension}`
    - [x] Upload to "imotko-prod" bucket with correct content type
    - [x] Retrieve public URL after upload
    - [x] Return object with size variant, storage key, and public URL
- [x] Implement batch upload for all size variants
- [x] Add retry logic (max 3 attempts) with exponential backoff
- [x] Handle upload errors gracefully (log and continue)

### 3.4 Image Pipeline Orchestration ✅

**Priority:** High
**Related Requirements:** REQ-2, REQ-3, REQ-11 (Batch Processing)

- [x] Implement `processPropertyImages(imageUrls)` function
    - [x] Limit concurrent downloads (max 3 at a time)
    - [x] For each image URL:
        1. [x] Download image
        2. [x] Process with Sharp (generate 3 sizes)
        3. [x] Upload all sizes to Supabase
        4. [x] Collect public URLs
    - [x] Generate photo JSON structure:
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
    - [x] Return array of photo objects
    - [x] Log progress and errors for each image

---

## Phase 4: AI-Based Data Normalization ✅

### 4.1 AI SDK Configuration ✅

**Priority:** High
**Related Requirements:** REQ-4 (Data Normalization with AI), REQ-12 (Configuration)

- [x] Set up AI SDK v6 with appropriate provider (OpenAI, Anthropic, etc.)
- [x] Create AI client with API key from environment
- [x] Define prompt templates for different normalization tasks
- [x] Implement rate limiting and retry logic

### 4.2 Price and Measurement Extraction ✅

**Priority:** High
**Related Requirements:** REQ-4 (Data Normalization with AI)

- [x] Implement `extractNumericValue(text, field)` function using AI
    - [x] Parse price strings (e.g., "550 ЕУР / месечно" → 550)
    - [x] Parse area strings (e.g., "62 m2" → 62)
    - [x] Handle various formats and currencies
    - [x] Return integer value or null if extraction fails
    - [x] Use AI to handle edge cases and variations

### 4.3 Enum Value Mapping ✅

**Priority:** High
**Related Requirements:** REQ-4 (Data Normalization with AI)

- [x] Implement `mapListingType(text)` function
    - [x] Map "Се изнајмува" → `for_rent`
    - [x] Map "Се продава" → `for_sale`
    - [x] Handle variations and typos using AI
    - [x] Return PropertyListingType enum value

- [x] Implement `classifyPropertyType(title, description)` function
    - [x] Analyze title and description with AI
    - [x] Classify into: flat, house, land, holiday_home, garage, commercial
    - [x] Return PropertyType enum value
    - [x] Provide confidence score, log low-confidence classifications

### 4.4 JSON Field Structuring ✅

**Priority:** Medium
**Related Requirements:** REQ-4, REQ-14 (Data Structure and JSON Fields)

- [x] Implement `structureName(title)` function
    - [x] Use AI to detect language
    - [x] Structure as: `{ "mk": "macedonian", "en": "english" }`
    - [x] If no translation available, duplicate or leave English null

- [x] Implement `structureDescription(description)` function
    - [x] Similar to name structuring
    - [x] Preserve formatting where possible

- [x] Implement `extractAttributes(sourceData)` function
    - [x] Parse features array from source
    - [x] Map to structured attributes object
    - [x] Extract additional attributes from description using AI
    - [x] Return JSON object for attributes field

### 4.5 Geocoding Implementation ✅

**Priority:** High
**Related Requirements:** REQ-5 (Address Geocoding)

- [x] Implement `geocodeAddress(location, address)` function in `geocoder.js`
    - [x] Parse location and address fields
    - [x] Use AI or external geocoding API (Google Maps, Nominatim)
    - [x] Return latitude and longitude
    - [x] Implement caching for identical locations
    - [x] Handle geocoding failures with default coordinates or skip property
    - [x] Log geocoding results and failures

### 4.6 Location Mapping ✅

**Priority:** Medium
**Related Requirements:** REQ-6 (Property Location Mapping)

- [x] Implement `mapPropertyLocation(locationText)` function
    - [x] Parse location string (e.g., "Центар, Скопjе")
    - [x] Query PropertyLocation table for matching records
    - [x] Use AI to handle ambiguous matches
    - [x] Return PropertyLocation ID
    - [x] Log missing locations for manual creation

---

## Phase 5: Property Persistence and Duplicate Handling ✅

### 5.1 External ID Generation ✅

**Priority:** High
**Related Requirements:** REQ-7 (Duplicate Prevention)

- [x] Implement `generateExternalId(propertyData)` function
    - [x] Create consistent hash or ID from source data
    - [x] Use combination of title, address, and source identifier
    - [x] Ensure uniqueness and consistency across imports

### 5.2 Duplicate Detection ✅

**Priority:** High
**Related Requirements:** REQ-7 (Duplicate Prevention), REQ-13 (Idempotency)

- [x] Implement `checkDuplicate(externalId)` function
    - [x] Query database for existing property with same externalId
    - [x] Return existing property or null
    - [x] Log duplicate detection

- [x] Implement configurable behavior:
    - [x] Skip duplicates (default)
    - [x] Update existing properties (optional)

### 5.3 Property Data Mapping ✅

**Priority:** High
**Related Requirements:** REQ-8 (Database Storage), REQ-14 (Data Structure)

- [x] Implement `mapToPropertyModel(normalizedData)` function in `property_mapper.js`
    - [x] Map all normalized fields to Property model fields
    - [x] Set required fields:
        - [x] `name` (Json)
        - [x] `latitude` (Float)
        - [x] `longitude` (Float)
        - [x] `address` (String)
        - [x] `price` (Int)
        - [x] `size` (Int)
        - [x] `description` (Json)
        - [x] `createdBy` (from env)
        - [x] `type` (PropertyType)
        - [x] `listingType` (PropertyListingType)
    - [x] Set optional fields:
        - [x] `photos` (Json)
        - [x] `attributes` (Json)
        - [x] `agencyId` (from env if configured)
        - [x] `propertyLocationId`
        - [x] `externalId`
    - [x] Set default values:
        - [x] `status` = `PENDING`
        - [x] `featured` = false
    - [x] Validate required fields are present
    - [x] Return property creation object

### 5.4 Database Insertion ✅

**Priority:** High
**Related Requirements:** REQ-8 (Database Storage), REQ-13 (Idempotency)

- [x] Implement `saveProperty(propertyData)` function
    - [x] Use Prisma client from `@database/client.js`
    - [x] Wrap in try-catch for error handling
    - [x] Use database transaction for atomicity
    - [x] Return created property or error
    - [x] Log successful creation with property ID
    - [x] Log failures with property data for debugging

---

## Phase 6: Orchestration and Job Execution ✅

### 6.1 Main Import Function ✅

**Priority:** High
**Related Requirements:** REQ-11 (Batch Processing), REQ-10 (Error Handling)

- [x] Implement `importProperties()` main function in `src/jobs/import_properties.js`
    - [x] Load configuration from environment
    - [x] Initialize logging
    - [x] Fetch properties from API
    - [x] Validate source data
    - [x] Process in batches (configurable size, default 10)
    - [x] For each property in batch:
        1. [x] Generate external ID
        2. [x] Check for duplicates
        3. [x] Process images
        4. [x] Normalize data with AI
        5. [x] Geocode address
        6. [x] Map to Property model
        7. [x] Save to database
    - [x] Collect statistics: total, success, failed, skipped
    - [x] Log summary on completion
    - [x] Handle errors gracefully (continue processing)

### 6.2 Batch Processing Logic ✅

**Priority:** High
**Related Requirements:** REQ-11 (Batch Processing and Performance)

- [x] Implement batch iteration with controlled concurrency
    - [x] Process batches sequentially
    - [x] Within batch, process properties in parallel (with limits)
    - [x] Wait for batch completion before starting next
    - [x] Implement progress logging (e.g., "Processing batch 3/10")

### 6.3 Error Handling and Logging ✅

**Priority:** High
**Related Requirements:** REQ-10 (Error Handling and Logging), REQ-13 (Retry Logic)

- [x] Implement comprehensive logging throughout:
    - [x] Job start: timestamp, configuration
    - [x] Fetch: start, completion, errors
    - [x] Per property: start processing, stage completions, errors
    - [x] Batch: completion statistics
    - [x] Job end: summary statistics, duration
- [x] Use structured logging with property identifiers
- [x] Implement error collection for final summary report
- [x] Ensure errors don't stop entire job (continue processing)

### 6.4 Test Mode Implementation ✅

**Priority:** Medium
**Related Requirements:** REQ-15 (Testing and Validation Mode)

- [x] Implement test mode flag check
- [x] When `IMPORT_TEST_MODE=true`:
    - [x] Skip database saves
    - [x] Log normalized data instead
    - [x] Optionally skip image uploads (configurable)
    - [x] Clearly log "TEST MODE" in all log output
    - [x] Generate test report with would-be database insertions

---

## Phase 7: Cron Job Integration and Monitoring ✅

### 7.1 Cron Job Setup ✅

**Priority:** Medium
**Related Requirements:** REQ-1 (External Data Fetching)

- [x] Configure cron schedule (e.g., daily at midnight)
- [x] Use existing cron infrastructure or node-cron package
- [x] Add job registration in application startup
- [x] Implement graceful shutdown handling

### 7.2 Execution Monitoring ✅

**Priority:** Low
**Related Requirements:** REQ-10 (Error Handling and Logging)

- [x] Implement execution tracking:
    - [x] Store last execution timestamp
    - [x] Track consecutive failures
    - [x] Alert on repeated failures (optional)
- [x] Create admin endpoint to view import history (optional)
- [x] Log retention and rotation strategy

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
