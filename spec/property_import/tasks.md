# Technical Tasks: Property Import Feature

This document provides a detailed, enumerated task list for implementing the property import feature. Each task is linked to the development plan and requirements.

---

## Phase 1: Foundation and Setup

### Dependencies Installation
- [ ] **Task 1.1.1**: Install Sharp package for image processing
  - **Plan:** 1.1 Environment and Dependencies Setup
  - **Requirements:** REQ-12
  - Command: `pnpm install sharp`

- [ ] **Task 1.1.2**: Install UUID package for unique ID generation
  - **Plan:** 1.1 Environment and Dependencies Setup
  - **Requirements:** REQ-12
  - Command: `pnpm install uuid`

- [ ] **Task 1.1.3**: Install AI SDK v6 core package
  - **Plan:** 1.1 Environment and Dependencies Setup
  - **Requirements:** REQ-4, REQ-12
  - Command: `pnpm install ai`

- [ ] **Task 1.1.4**: Install AI SDK provider (OpenAI or Anthropic)
  - **Plan:** 1.1 Environment and Dependencies Setup
  - **Requirements:** REQ-4, REQ-12
  - Command: `pnpm install @ai-sdk/openai`

- [ ] **Task 1.1.5**: Verify @supabase/supabase-js is installed
  - **Plan:** 1.1 Environment and Dependencies Setup
  - **Requirements:** REQ-3, REQ-12
  - Check package.json

### Environment Configuration
- [ ] **Task 1.2.1**: Add `IMPORT_DATA_SOURCE_URL` to .env file
  - **Plan:** 1.1 Environment and Dependencies Setup
  - **Requirements:** REQ-12
  - Default value: `https://globalracecalendar.com/imotko/delta.json`

- [ ] **Task 1.2.2**: Add `IMPORT_SYSTEM_USER_ID` to .env file
  - **Plan:** 1.1 Environment and Dependencies Setup
  - **Requirements:** REQ-9, REQ-12
  - Note: Will be populated after system user creation

- [ ] **Task 1.2.3**: Add `IMPORT_DEFAULT_AGENCY_ID` to .env file (optional)
  - **Plan:** 1.1 Environment and Dependencies Setup
  - **Requirements:** REQ-9, REQ-12

- [ ] **Task 1.2.4**: Add `IMPORT_BATCH_SIZE` to .env file
  - **Plan:** 1.1 Environment and Dependencies Setup
  - **Requirements:** REQ-11, REQ-12
  - Default value: `10`

- [ ] **Task 1.2.5**: Add `IMPORT_TEST_MODE` to .env file
  - **Plan:** 1.1 Environment and Dependencies Setup
  - **Requirements:** REQ-15, REQ-12
  - Default value: `false`

- [ ] **Task 1.2.6**: Add `AI_API_KEY` to .env file
  - **Plan:** 1.1 Environment and Dependencies Setup
  - **Requirements:** REQ-4, REQ-12
  - Note: Get from AI provider dashboard

- [ ] **Task 1.2.7**: Update .env.example with all new environment variables
  - **Plan:** 1.1 Environment and Dependencies Setup
  - **Requirements:** REQ-12
  - Include descriptions for each variable

### System User Setup
- [ ] **Task 1.3.1**: Create system user in database or verify existing
  - **Plan:** 1.2 System User and Agency Setup
  - **Requirements:** REQ-9
  - Use Prisma Studio or create migration

- [ ] **Task 1.3.2**: Create "Imported Listings" agency (optional)
  - **Plan:** 1.2 System User and Agency Setup
  - **Requirements:** REQ-9
  - Use Prisma Studio or create migration

- [ ] **Task 1.3.3**: Document system user ID and agency ID in .env
  - **Plan:** 1.2 System User and Agency Setup
  - **Requirements:** REQ-9

### Project Structure
- [ ] **Task 1.4.1**: Create `src/jobs/helpers/` directory
  - **Plan:** 1.3 Create Job File Structure
  - **Requirements:** All

- [ ] **Task 1.4.2**: Create `src/jobs/helpers/image_processor.js` file stub
  - **Plan:** 1.3 Create Job File Structure
  - **Requirements:** REQ-2, REQ-3

- [ ] **Task 1.4.3**: Create `src/jobs/helpers/ai_normalizer.js` file stub
  - **Plan:** 1.3 Create Job File Structure
  - **Requirements:** REQ-4

- [ ] **Task 1.4.4**: Create `src/jobs/helpers/geocoder.js` file stub
  - **Plan:** 1.3 Create Job File Structure
  - **Requirements:** REQ-5

- [ ] **Task 1.4.5**: Create `src/jobs/helpers/property_mapper.js` file stub
  - **Plan:** 1.3 Create Job File Structure
  - **Requirements:** REQ-8

- [ ] **Task 1.4.6**: Create configuration loader in `src/jobs/import_properties.js`
  - **Plan:** 1.3 Create Job File Structure
  - **Requirements:** REQ-12
  - Load all environment variables with validation

---

## Phase 2: Core Data Fetching and Validation

### API Fetching Implementation
- [ ] **Task 2.1.1**: Implement `fetchPropertiesFromAPI()` function
  - **Plan:** 2.1 Implement External API Fetching
  - **Requirements:** REQ-1
  - Use native fetch() with timeout

- [ ] **Task 2.1.2**: Add error handling for network failures in fetch function
  - **Plan:** 2.1 Implement External API Fetching
  - **Requirements:** REQ-1, REQ-10
  - Handle timeouts, connection errors, DNS failures

- [ ] **Task 2.1.3**: Implement retry logic for fetch (max 3 attempts)
  - **Plan:** 2.1 Implement External API Fetching
  - **Requirements:** REQ-1, REQ-13
  - Use exponential backoff (1s, 2s, 4s)

- [ ] **Task 2.1.4**: Validate HTTP response status and parse JSON
  - **Plan:** 2.1 Implement External API Fetching
  - **Requirements:** REQ-1
  - Check for 200 status, handle JSON parse errors

- [ ] **Task 2.1.5**: Add logging for fetch start, completion, and errors
  - **Plan:** 2.1 Implement External API Fetching
  - **Requirements:** REQ-1, REQ-10
  - Log timestamp, URL, response size

### Data Validation
- [ ] **Task 2.2.1**: Implement `validateSourceData(property)` function
  - **Plan:** 2.2 Data Structure Validation
  - **Requirements:** REQ-1, REQ-8
  - Check required fields: title, images, price, location

- [ ] **Task 2.2.2**: Add data type validation in validateSourceData
  - **Plan:** 2.2 Data Structure Validation
  - **Requirements:** REQ-1, REQ-8
  - Verify images is array, title is string, etc.

- [ ] **Task 2.2.3**: Filter valid and invalid properties into separate arrays
  - **Plan:** 2.2 Data Structure Validation
  - **Requirements:** REQ-1, REQ-10
  - Return { valid: [], invalid: [] }

- [ ] **Task 2.2.4**: Log validation errors with property index and reason
  - **Plan:** 2.2 Data Structure Validation
  - **Requirements:** REQ-1, REQ-10

---

## Phase 3: Image Processing Pipeline

### Image Download Module
- [ ] **Task 3.1.1**: Implement `downloadImage(url)` function in image_processor.js
  - **Plan:** 3.1 Image Download Module
  - **Requirements:** REQ-2
  - Use fetch() to download binary data

- [ ] **Task 3.1.2**: Add timeout handling (15 seconds) for image downloads
  - **Plan:** 3.1 Image Download Module
  - **Requirements:** REQ-2, REQ-10
  - Use AbortController

- [ ] **Task 3.1.3**: Handle different image content types (jpeg, png, webp)
  - **Plan:** 3.1 Image Download Module
  - **Requirements:** REQ-2
  - Detect from Content-Type header

- [ ] **Task 3.1.4**: Return Buffer object from downloadImage
  - **Plan:** 3.1 Image Download Module
  - **Requirements:** REQ-2
  - Convert response to Buffer

- [ ] **Task 3.1.5**: Add retry logic for image downloads (max 3 attempts, exponential backoff)
  - **Plan:** 3.1 Image Download Module
  - **Requirements:** REQ-2, REQ-13
  - Retry on network errors and 5xx responses

- [ ] **Task 3.1.6**: Handle HTTP errors (404, 403, etc.) in downloadImage
  - **Plan:** 3.1 Image Download Module
  - **Requirements:** REQ-2, REQ-10
  - Log error and return null

### Image Processing with Sharp
- [ ] **Task 3.2.1**: Configure Sharp settings (cache: false, concurrency: 1)
  - **Plan:** 3.2 Image Processing with Sharp
  - **Requirements:** REQ-2
  - Set at module level

- [ ] **Task 3.2.2**: Implement `processImage(imageBuffer, size)` function
  - **Plan:** 3.2 Image Processing with Sharp
  - **Requirements:** REQ-2
  - Accept buffer and size config (width, quality)

- [ ] **Task 3.2.3**: Detect image format from buffer in processImage
  - **Plan:** 3.2 Image Processing with Sharp
  - **Requirements:** REQ-2
  - Use Sharp metadata()

- [ ] **Task 3.2.4**: Implement resize logic for small size (300px, quality 60)
  - **Plan:** 3.2 Image Processing with Sharp
  - **Requirements:** REQ-2
  - Return processed buffer

- [ ] **Task 3.2.5**: Implement resize logic for medium size (650px, quality 60)
  - **Plan:** 3.2 Image Processing with Sharp
  - **Requirements:** REQ-2

- [ ] **Task 3.2.6**: Implement resize logic for large size (900px, quality 60)
  - **Plan:** 3.2 Image Processing with Sharp
  - **Requirements:** REQ-2

- [ ] **Task 3.2.7**: Apply PNG-specific compression (level 6, no adaptive filtering)
  - **Plan:** 3.2 Image Processing with Sharp
  - **Requirements:** REQ-2
  - Use sharp.png({ compressionLevel: 6, adaptiveFiltering: false })

- [ ] **Task 3.2.8**: Apply JPEG compression (quality 60)
  - **Plan:** 3.2 Image Processing with Sharp
  - **Requirements:** REQ-2
  - Use sharp.jpeg({ quality: 60 })

- [ ] **Task 3.2.9**: Apply WebP compression (quality 60)
  - **Plan:** 3.2 Image Processing with Sharp
  - **Requirements:** REQ-2
  - Use sharp.webp({ quality: 60 })

- [ ] **Task 3.2.10**: Implement `processAllSizes(imageBuffer)` function
  - **Plan:** 3.2 Image Processing with Sharp
  - **Requirements:** REQ-2
  - Generate all 3 sizes, return array with metadata

### Supabase Upload Module
- [ ] **Task 3.3.1**: Initialize Supabase client with service role key
  - **Plan:** 3.3 Supabase Upload Module
  - **Requirements:** REQ-3
  - Import from @supabase/supabase-js

- [ ] **Task 3.3.2**: Implement `generateUniqueFileName()` function
  - **Plan:** 3.3 Supabase Upload Module
  - **Requirements:** REQ-2, REQ-3
  - Use uuid and timestamp: `{uuid}_{timestamp}`

- [ ] **Task 3.3.3**: Implement `uploadToSupabase(buffer, size, extension)` function
  - **Plan:** 3.3 Supabase Upload Module
  - **Requirements:** REQ-3
  - Upload single size variant

- [ ] **Task 3.3.4**: Generate filename with size suffix in uploadToSupabase
  - **Plan:** 3.3 Supabase Upload Module
  - **Requirements:** REQ-3
  - Format: `{uuid}_{timestamp}-{size}.{extension}`

- [ ] **Task 3.3.5**: Upload to "imotko-prod" bucket with correct content type
  - **Plan:** 3.3 Supabase Upload Module
  - **Requirements:** REQ-3
  - Use supabase.storage.from('imotko-prod').upload()

- [ ] **Task 3.3.6**: Retrieve public URL after successful upload
  - **Plan:** 3.3 Supabase Upload Module
  - **Requirements:** REQ-3
  - Use getPublicUrl()

- [ ] **Task 3.3.7**: Return object with size, storageKey, and publicUrl
  - **Plan:** 3.3 Supabase Upload Module
  - **Requirements:** REQ-3
  - Format: { size: 'small', storageKey: '...', publicUrl: '...' }

- [ ] **Task 3.3.8**: Add retry logic for uploads (max 3 attempts, exponential backoff)
  - **Plan:** 3.3 Supabase Upload Module
  - **Requirements:** REQ-3, REQ-13

- [ ] **Task 3.3.9**: Handle upload errors and log failures
  - **Plan:** 3.3 Supabase Upload Module
  - **Requirements:** REQ-3, REQ-10

### Image Pipeline Orchestration
- [ ] **Task 3.4.1**: Implement `processPropertyImages(imageUrls)` main function
  - **Plan:** 3.4 Image Pipeline Orchestration
  - **Requirements:** REQ-2, REQ-3
  - Orchestrate download → process → upload

- [ ] **Task 3.4.2**: Implement concurrent download limiting (max 3 at a time)
  - **Plan:** 3.4 Image Pipeline Orchestration
  - **Requirements:** REQ-11
  - Use Promise pool or p-limit library

- [ ] **Task 3.4.3**: Process each image: download, resize, upload workflow
  - **Plan:** 3.4 Image Pipeline Orchestration
  - **Requirements:** REQ-2, REQ-3
  - For each URL in imageUrls array

- [ ] **Task 3.4.4**: Generate photo JSON structure after all uploads complete
  - **Plan:** 3.4 Image Pipeline Orchestration
  - **Requirements:** REQ-3, REQ-14
  - Format: { id, name: null, sizes: { small, medium, large }, s3Urls: [] }

- [ ] **Task 3.4.5**: Handle partial failures (some images fail, others succeed)
  - **Plan:** 3.4 Image Pipeline Orchestration
  - **Requirements:** REQ-2, REQ-10
  - Continue processing, log failures

- [ ] **Task 3.4.6**: Add progress logging for image processing
  - **Plan:** 3.4 Image Pipeline Orchestration
  - **Requirements:** REQ-10
  - Log "Processing image X of Y"

---

## Phase 4: AI-Based Data Normalization

### AI SDK Configuration
- [ ] **Task 4.1.1**: Import and configure AI SDK v6
  - **Plan:** 4.1 AI SDK Configuration
  - **Requirements:** REQ-4
  - Import from 'ai' package

- [ ] **Task 4.1.2**: Initialize AI provider client (OpenAI/Anthropic) in ai_normalizer.js
  - **Plan:** 4.1 AI SDK Configuration
  - **Requirements:** REQ-4, REQ-12
  - Use API key from environment

- [ ] **Task 4.1.3**: Define prompt templates for data normalization tasks
  - **Plan:** 4.1 AI SDK Configuration
  - **Requirements:** REQ-4
  - Templates for price extraction, classification, etc.

- [ ] **Task 4.1.4**: Implement rate limiting for AI API calls
  - **Plan:** 4.1 AI SDK Configuration
  - **Requirements:** REQ-11
  - Use p-limit or similar

- [ ] **Task 4.1.5**: Implement retry logic for AI API failures
  - **Plan:** 4.1 AI SDK Configuration
  - **Requirements:** REQ-4, REQ-13
  - Retry once on failure

### Price and Measurement Extraction
- [ ] **Task 4.2.1**: Implement `extractPrice(priceText)` function using AI
  - **Plan:** 4.2 Price and Measurement Extraction
  - **Requirements:** REQ-4
  - Parse strings like "550 ЕУР / месечно" → 550

- [ ] **Task 4.2.2**: Implement `extractArea(areaText)` function using AI
  - **Plan:** 4.2 Price and Measurement Extraction
  - **Requirements:** REQ-4
  - Parse strings like "62 m2" → 62

- [ ] **Task 4.2.3**: Handle various price formats and currencies in extractPrice
  - **Plan:** 4.2 Price and Measurement Extraction
  - **Requirements:** REQ-4
  - Support EUR, MKD, with/without symbols

- [ ] **Task 4.2.4**: Return integer values or null if extraction fails
  - **Plan:** 4.2 Price and Measurement Extraction
  - **Requirements:** REQ-4, REQ-10

- [ ] **Task 4.2.5**: Add logging for extraction failures
  - **Plan:** 4.2 Price and Measurement Extraction
  - **Requirements:** REQ-4, REQ-10

### Enum Value Mapping
- [ ] **Task 4.3.1**: Implement `mapListingType(listingTypeText)` function
  - **Plan:** 4.3 Enum Value Mapping
  - **Requirements:** REQ-4
  - Map Macedonian to enum values

- [ ] **Task 4.3.2**: Add mapping rules for "Се изнајмува" → for_rent
  - **Plan:** 4.3 Enum Value Mapping
  - **Requirements:** REQ-4
  - Use AI or keyword matching

- [ ] **Task 4.3.3**: Add mapping rules for "Се продава" → for_sale
  - **Plan:** 4.3 Enum Value Mapping
  - **Requirements:** REQ-4

- [ ] **Task 4.3.4**: Handle variations and typos using AI fallback
  - **Plan:** 4.3 Enum Value Mapping
  - **Requirements:** REQ-4
  - If exact match fails, use AI

- [ ] **Task 4.3.5**: Implement `classifyPropertyType(title, description)` function
  - **Plan:** 4.3 Enum Value Mapping
  - **Requirements:** REQ-4
  - Use AI to classify into PropertyType enum

- [ ] **Task 4.3.6**: Define classification prompt for property types
  - **Plan:** 4.3 Enum Value Mapping
  - **Requirements:** REQ-4
  - Instruct AI to return: flat, house, land, holiday_home, garage, commercial

- [ ] **Task 4.3.7**: Return PropertyType enum value from classification
  - **Plan:** 4.3 Enum Value Mapping
  - **Requirements:** REQ-4

- [ ] **Task 4.3.8**: Log low-confidence classifications for manual review
  - **Plan:** 4.3 Enum Value Mapping
  - **Requirements:** REQ-4, REQ-10

### JSON Field Structuring
- [ ] **Task 4.4.1**: Implement `structureName(title)` function
  - **Plan:** 4.4 JSON Field Structuring
  - **Requirements:** REQ-4, REQ-14
  - Return { mk: "...", en: "..." }

- [ ] **Task 4.4.2**: Use AI to detect language in structureName
  - **Plan:** 4.4 JSON Field Structuring
  - **Requirements:** REQ-4
  - Detect if Macedonian or English

- [ ] **Task 4.4.3**: Optionally translate title to English using AI
  - **Plan:** 4.4 JSON Field Structuring
  - **Requirements:** REQ-4
  - If translation available, populate en field

- [ ] **Task 4.4.4**: Implement `structureDescription(description)` function
  - **Plan:** 4.4 JSON Field Structuring
  - **Requirements:** REQ-4, REQ-14
  - Similar to structureName

- [ ] **Task 4.4.5**: Preserve formatting in descriptions where possible
  - **Plan:** 4.4 JSON Field Structuring
  - **Requirements:** REQ-14

- [ ] **Task 4.4.6**: Implement `extractAttributes(sourceData)` function
  - **Plan:** 4.4 JSON Field Structuring
  - **Requirements:** REQ-4, REQ-14
  - Parse features array from source

- [ ] **Task 4.4.7**: Map features to structured attributes object
  - **Plan:** 4.4 JSON Field Structuring
  - **Requirements:** REQ-14
  - Example: ["Балкон / Тераса"] → { hasBalcony: true }

- [ ] **Task 4.4.8**: Use AI to extract additional attributes from description
  - **Plan:** 4.4 JSON Field Structuring
  - **Requirements:** REQ-4
  - Extract: year built, floor, elevator, parking, etc.

- [ ] **Task 4.4.9**: Return JSON object for attributes field
  - **Plan:** 4.4 JSON Field Structuring
  - **Requirements:** REQ-14

### Geocoding Implementation
- [ ] **Task 4.5.1**: Implement `geocodeAddress(location, address)` function in geocoder.js
  - **Plan:** 4.5 Geocoding Implementation
  - **Requirements:** REQ-5
  - Main geocoding function

- [ ] **Task 4.5.2**: Parse location and address fields
  - **Plan:** 4.5 Geocoding Implementation
  - **Requirements:** REQ-5
  - Combine into full address string

- [ ] **Task 4.5.3**: Choose geocoding strategy (AI vs external API)
  - **Plan:** 4.5 Geocoding Implementation
  - **Requirements:** REQ-5
  - Decision: Use AI for simplicity or Google Maps/Nominatim

- [ ] **Task 4.5.4**: Implement geocoding API call (if using external service)
  - **Plan:** 4.5 Geocoding Implementation
  - **Requirements:** REQ-5
  - Configure API key and endpoint

- [ ] **Task 4.5.5**: Implement AI-based geocoding (if using AI)
  - **Plan:** 4.5 Geocoding Implementation
  - **Requirements:** REQ-5
  - Use AI to estimate coordinates for known locations

- [ ] **Task 4.5.6**: Return latitude and longitude from geocodeAddress
  - **Plan:** 4.5 Geocoding Implementation
  - **Requirements:** REQ-5
  - Format: { latitude: number, longitude: number }

- [ ] **Task 4.5.7**: Implement caching for identical locations
  - **Plan:** 4.5 Geocoding Implementation
  - **Requirements:** REQ-5
  - Use Map or object to cache results

- [ ] **Task 4.5.8**: Handle geocoding failures with default coordinates or skip
  - **Plan:** 4.5 Geocoding Implementation
  - **Requirements:** REQ-5, REQ-10
  - Decision: Use default (Skopje center) or skip property

- [ ] **Task 4.5.9**: Log geocoding results and failures
  - **Plan:** 4.5 Geocoding Implementation
  - **Requirements:** REQ-5, REQ-10

### Location Mapping
- [ ] **Task 4.6.1**: Implement `mapPropertyLocation(locationText)` function
  - **Plan:** 4.6 Location Mapping
  - **Requirements:** REQ-6
  - Map to PropertyLocation table

- [ ] **Task 4.6.2**: Parse location string (e.g., "Центар, Скопjе")
  - **Plan:** 4.6 Location Mapping
  - **Requirements:** REQ-6
  - Split into parts

- [ ] **Task 4.6.3**: Query PropertyLocation table for matching records
  - **Plan:** 4.6 Location Mapping
  - **Requirements:** REQ-6
  - Use Prisma client

- [ ] **Task 4.6.4**: Implement fuzzy matching or AI matching for ambiguous locations
  - **Plan:** 4.6 Location Mapping
  - **Requirements:** REQ-6
  - Use AI to resolve "Центар" → specific PropertyLocation ID

- [ ] **Task 4.6.5**: Return PropertyLocation ID
  - **Plan:** 4.6 Location Mapping
  - **Requirements:** REQ-6

- [ ] **Task 4.6.6**: Log missing locations for manual creation
  - **Plan:** 4.6 Location Mapping
  - **Requirements:** REQ-6, REQ-10

---

## Phase 5: Property Persistence and Duplicate Handling

### External ID Generation
- [ ] **Task 5.1.1**: Implement `generateExternalId(propertyData)` function
  - **Plan:** 5.1 External ID Generation
  - **Requirements:** REQ-7
  - Create consistent identifier

- [ ] **Task 5.1.2**: Use combination of title, address, and source for ID
  - **Plan:** 5.1 External ID Generation
  - **Requirements:** REQ-7
  - Hash or concatenate unique fields

- [ ] **Task 5.1.3**: Ensure ID is consistent across imports (same property = same ID)
  - **Plan:** 5.1 External ID Generation
  - **Requirements:** REQ-7, REQ-13

### Duplicate Detection
- [ ] **Task 5.2.1**: Implement `checkDuplicate(externalId)` function
  - **Plan:** 5.2 Duplicate Detection
  - **Requirements:** REQ-7
  - Query database for existing property

- [ ] **Task 5.2.2**: Query database using Prisma with externalId filter
  - **Plan:** 5.2 Duplicate Detection
  - **Requirements:** REQ-7
  - Use prisma.property.findUnique({ where: { externalId } })

- [ ] **Task 5.2.3**: Return existing property or null
  - **Plan:** 5.2 Duplicate Detection
  - **Requirements:** REQ-7

- [ ] **Task 5.2.4**: Log duplicate detection
  - **Plan:** 5.2 Duplicate Detection
  - **Requirements:** REQ-7, REQ-10

- [ ] **Task 5.2.5**: Implement skip behavior for duplicates (default)
  - **Plan:** 5.2 Duplicate Detection
  - **Requirements:** REQ-7
  - Return early if duplicate found

- [ ] **Task 5.2.6**: Implement update behavior for duplicates (optional, configurable)
  - **Plan:** 5.2 Duplicate Detection
  - **Requirements:** REQ-7
  - Use IMPORT_UPDATE_DUPLICATES env var

### Property Data Mapping
- [ ] **Task 5.3.1**: Implement `mapToPropertyModel(normalizedData)` function in property_mapper.js
  - **Plan:** 5.3 Property Data Mapping
  - **Requirements:** REQ-8, REQ-14
  - Map normalized data to Prisma create object

- [ ] **Task 5.3.2**: Map required field: name (Json)
  - **Plan:** 5.3 Property Data Mapping
  - **Requirements:** REQ-8
  - From structureName() result

- [ ] **Task 5.3.3**: Map required field: latitude (Float)
  - **Plan:** 5.3 Property Data Mapping
  - **Requirements:** REQ-8
  - From geocoding result

- [ ] **Task 5.3.4**: Map required field: longitude (Float)
  - **Plan:** 5.3 Property Data Mapping
  - **Requirements:** REQ-8
  - From geocoding result

- [ ] **Task 5.3.5**: Map required field: address (String)
  - **Plan:** 5.3 Property Data Mapping
  - **Requirements:** REQ-8
  - From source data

- [ ] **Task 5.3.6**: Map required field: price (Int)
  - **Plan:** 5.3 Property Data Mapping
  - **Requirements:** REQ-8
  - From extractPrice() result

- [ ] **Task 5.3.7**: Map required field: size (Int)
  - **Plan:** 5.3 Property Data Mapping
  - **Requirements:** REQ-8
  - From extractArea() result

- [ ] **Task 5.3.8**: Map required field: description (Json)
  - **Plan:** 5.3 Property Data Mapping
  - **Requirements:** REQ-8
  - From structureDescription() result

- [ ] **Task 5.3.9**: Map required field: createdBy (String)
  - **Plan:** 5.3 Property Data Mapping
  - **Requirements:** REQ-8, REQ-9
  - From IMPORT_SYSTEM_USER_ID env var

- [ ] **Task 5.3.10**: Map required field: type (PropertyType)
  - **Plan:** 5.3 Property Data Mapping
  - **Requirements:** REQ-8
  - From classifyPropertyType() result

- [ ] **Task 5.3.11**: Map required field: listingType (PropertyListingType)
  - **Plan:** 5.3 Property Data Mapping
  - **Requirements:** REQ-8
  - From mapListingType() result

- [ ] **Task 5.3.12**: Map optional field: photos (Json)
  - **Plan:** 5.3 Property Data Mapping
  - **Requirements:** REQ-14
  - From processPropertyImages() result

- [ ] **Task 5.3.13**: Map optional field: attributes (Json)
  - **Plan:** 5.3 Property Data Mapping
  - **Requirements:** REQ-14
  - From extractAttributes() result

- [ ] **Task 5.3.14**: Map optional field: agencyId (String)
  - **Plan:** 5.3 Property Data Mapping
  - **Requirements:** REQ-9
  - From IMPORT_DEFAULT_AGENCY_ID env var if set

- [ ] **Task 5.3.15**: Map optional field: propertyLocationId (String)
  - **Plan:** 5.3 Property Data Mapping
  - **Requirements:** REQ-6
  - From mapPropertyLocation() result

- [ ] **Task 5.3.16**: Map optional field: externalId (String)
  - **Plan:** 5.3 Property Data Mapping
  - **Requirements:** REQ-7
  - From generateExternalId() result

- [ ] **Task 5.3.17**: Set default: status = PENDING
  - **Plan:** 5.3 Property Data Mapping
  - **Requirements:** REQ-8

- [ ] **Task 5.3.18**: Set default: featured = false
  - **Plan:** 5.3 Property Data Mapping
  - **Requirements:** REQ-8

- [ ] **Task 5.3.19**: Validate all required fields are present before returning
  - **Plan:** 5.3 Property Data Mapping
  - **Requirements:** REQ-8
  - Throw error if any required field is missing

### Database Insertion
- [ ] **Task 5.4.1**: Implement `saveProperty(propertyData)` function
  - **Plan:** 5.4 Database Insertion
  - **Requirements:** REQ-8
  - Use Prisma client

- [ ] **Task 5.4.2**: Import Prisma client from @database/client.js
  - **Plan:** 5.4 Database Insertion
  - **Requirements:** REQ-8
  - Use path alias

- [ ] **Task 5.4.3**: Wrap database operation in try-catch
  - **Plan:** 5.4 Database Insertion
  - **Requirements:** REQ-8, REQ-10
  - Catch Prisma errors

- [ ] **Task 5.4.4**: Use Prisma transaction for atomicity
  - **Plan:** 5.4 Database Insertion
  - **Requirements:** REQ-13
  - Use prisma.$transaction() if needed

- [ ] **Task 5.4.5**: Call prisma.property.create() with mapped data
  - **Plan:** 5.4 Database Insertion
  - **Requirements:** REQ-8

- [ ] **Task 5.4.6**: Return created property on success
  - **Plan:** 5.4 Database Insertion
  - **Requirements:** REQ-8

- [ ] **Task 5.4.7**: Log successful creation with property ID
  - **Plan:** 5.4 Database Insertion
  - **Requirements:** REQ-8, REQ-10

- [ ] **Task 5.4.8**: Log failures with property data for debugging
  - **Plan:** 5.4 Database Insertion
  - **Requirements:** REQ-8, REQ-10
  - Include error message and stack trace

---

## Phase 6: Orchestration and Job Execution

### Main Import Function
- [ ] **Task 6.1.1**: Implement `importProperties()` main function in import_properties.js
  - **Plan:** 6.1 Main Import Function
  - **Requirements:** All
  - Main orchestration function

- [ ] **Task 6.1.2**: Load configuration from environment variables
  - **Plan:** 6.1 Main Import Function
  - **Requirements:** REQ-12
  - Validate all required env vars are present

- [ ] **Task 6.1.3**: Initialize logging for job execution
  - **Plan:** 6.1 Main Import Function
  - **Requirements:** REQ-10
  - Log job start with timestamp and config

- [ ] **Task 6.1.4**: Fetch properties from API using fetchPropertiesFromAPI()
  - **Plan:** 6.1 Main Import Function
  - **Requirements:** REQ-1

- [ ] **Task 6.1.5**: Validate source data using validateSourceData()
  - **Plan:** 6.1 Main Import Function
  - **Requirements:** REQ-1

- [ ] **Task 6.1.6**: Initialize statistics counters (total, success, failed, skipped)
  - **Plan:** 6.1 Main Import Function
  - **Requirements:** REQ-10

- [ ] **Task 6.1.7**: Process properties in batches (use IMPORT_BATCH_SIZE)
  - **Plan:** 6.1 Main Import Function
  - **Requirements:** REQ-11
  - Loop through properties in chunks

- [ ] **Task 6.1.8**: For each property, execute full import pipeline
  - **Plan:** 6.1 Main Import Function
  - **Requirements:** All
  - generateExternalId → checkDuplicate → processImages → normalize → geocode → map → save

- [ ] **Task 6.1.9**: Increment success counter on successful import
  - **Plan:** 6.1 Main Import Function
  - **Requirements:** REQ-10

- [ ] **Task 6.1.10**: Increment failed counter on import failure
  - **Plan:** 6.1 Main Import Function
  - **Requirements:** REQ-10

- [ ] **Task 6.1.11**: Increment skipped counter for duplicates
  - **Plan:** 6.1 Main Import Function
  - **Requirements:** REQ-7, REQ-10

- [ ] **Task 6.1.12**: Continue processing on individual property errors
  - **Plan:** 6.1 Main Import Function
  - **Requirements:** REQ-10
  - Don't stop entire job on single failure

- [ ] **Task 6.1.13**: Log summary statistics on completion
  - **Plan:** 6.1 Main Import Function
  - **Requirements:** REQ-10
  - Log total, success, failed, skipped, duration

### Batch Processing Logic
- [ ] **Task 6.2.1**: Implement batch iteration logic
  - **Plan:** 6.2 Batch Processing Logic
  - **Requirements:** REQ-11
  - Split properties into batches

- [ ] **Task 6.2.2**: Process batches sequentially (wait for batch completion)
  - **Plan:** 6.2 Batch Processing Logic
  - **Requirements:** REQ-11
  - Use await for each batch

- [ ] **Task 6.2.3**: Process properties within batch in parallel (with limits)
  - **Plan:** 6.2 Batch Processing Logic
  - **Requirements:** REQ-11
  - Use Promise.all() for batch

- [ ] **Task 6.2.4**: Add progress logging for batch completion
  - **Plan:** 6.2 Batch Processing Logic
  - **Requirements:** REQ-10
  - Log "Processing batch X/Y"

### Error Handling and Logging
- [ ] **Task 6.3.1**: Implement structured logging throughout import process
  - **Plan:** 6.3 Error Handling and Logging
  - **Requirements:** REQ-10
  - Use consistent log format

- [ ] **Task 6.3.2**: Log job start with timestamp and configuration
  - **Plan:** 6.3 Error Handling and Logging
  - **Requirements:** REQ-10

- [ ] **Task 6.3.3**: Log fetch start, completion, and errors
  - **Plan:** 6.3 Error Handling and Logging
  - **Requirements:** REQ-10

- [ ] **Task 6.3.4**: Log per-property processing stages (start, stage completions, errors)
  - **Plan:** 6.3 Error Handling and Logging
  - **Requirements:** REQ-10
  - Include property identifier in logs

- [ ] **Task 6.3.5**: Log batch completion with statistics
  - **Plan:** 6.3 Error Handling and Logging
  - **Requirements:** REQ-10

- [ ] **Task 6.3.6**: Log job end with summary statistics and duration
  - **Plan:** 6.3 Error Handling and Logging
  - **Requirements:** REQ-10

- [ ] **Task 6.3.7**: Collect errors in array for final summary report
  - **Plan:** 6.3 Error Handling and Logging
  - **Requirements:** REQ-10

- [ ] **Task 6.3.8**: Ensure errors don't stop entire job (continue processing)
  - **Plan:** 6.3 Error Handling and Logging
  - **Requirements:** REQ-10
  - Use try-catch around each property

### Test Mode Implementation
- [ ] **Task 6.4.1**: Check IMPORT_TEST_MODE environment variable
  - **Plan:** 6.4 Test Mode Implementation
  - **Requirements:** REQ-15

- [ ] **Task 6.4.2**: When test mode enabled, skip database saves
  - **Plan:** 6.4 Test Mode Implementation
  - **Requirements:** REQ-15
  - Replace saveProperty() with console.log()

- [ ] **Task 6.4.3**: When test mode enabled, log normalized data instead
  - **Plan:** 6.4 Test Mode Implementation
  - **Requirements:** REQ-15
  - Log full property object

- [ ] **Task 6.4.4**: Optionally skip image uploads in test mode (configurable)
  - **Plan:** 6.4 Test Mode Implementation
  - **Requirements:** REQ-15
  - Use IMPORT_TEST_SKIP_IMAGES env var

- [ ] **Task 6.4.5**: Add "TEST MODE" indicator in all log output
  - **Plan:** 6.4 Test Mode Implementation
  - **Requirements:** REQ-15
  - Prefix logs with [TEST MODE]

- [ ] **Task 6.4.6**: Generate test report summary
  - **Plan:** 6.4 Test Mode Implementation
  - **Requirements:** REQ-15
  - Show what would have been saved

---

## Phase 7: Cron Job Integration and Monitoring

### Cron Job Setup
- [ ] **Task 7.1.1**: Research existing cron infrastructure in project
  - **Plan:** 7.1 Cron Job Setup
  - **Requirements:** REQ-1
  - Check if node-cron or similar is already used

- [ ] **Task 7.1.2**: Install node-cron package if not present
  - **Plan:** 7.1 Cron Job Setup
  - **Requirements:** REQ-1
  - Command: npm install node-cron

- [ ] **Task 7.1.3**: Configure cron schedule (e.g., daily at midnight)
  - **Plan:** 7.1 Cron Job Setup
  - **Requirements:** REQ-1
  - Use cron expression: '0 0 * * *'

- [ ] **Task 7.1.4**: Register job in application startup (app.js or similar)
  - **Plan:** 7.1 Cron Job Setup
  - **Requirements:** REQ-1

- [ ] **Task 7.1.5**: Implement graceful shutdown handling for running jobs
  - **Plan:** 7.1 Cron Job Setup
  - **Requirements:** REQ-1
  - Clean up on SIGTERM/SIGINT

- [ ] **Task 7.1.6**: Add ability to trigger job manually via CLI or endpoint
  - **Plan:** 7.1 Cron Job Setup
  - **Requirements:** REQ-1
  - For testing and debugging

### Execution Monitoring
- [ ] **Task 7.2.1**: Create table/collection to store job execution history
  - **Plan:** 7.2 Execution Monitoring
  - **Requirements:** REQ-10
  - Track: startTime, endTime, status, statistics

- [ ] **Task 7.2.2**: Store last execution timestamp in database
  - **Plan:** 7.2 Execution Monitoring
  - **Requirements:** REQ-10

- [ ] **Task 7.2.3**: Track consecutive failures counter
  - **Plan:** 7.2 Execution Monitoring
  - **Requirements:** REQ-10

- [ ] **Task 7.2.4**: Implement alert on repeated failures (optional)
  - **Plan:** 7.2 Execution Monitoring
  - **Requirements:** REQ-10
  - Send email or notification after N failures

- [ ] **Task 7.2.5**: Create admin endpoint to view import history (optional)
  - **Plan:** 7.2 Execution Monitoring
  - **Requirements:** REQ-10
  - GET /api/v1/admin/import-history

- [ ] **Task 7.2.6**: Implement log retention and rotation strategy
  - **Plan:** 7.2 Execution Monitoring
  - **Requirements:** REQ-10
  - Keep last 30 days of logs

---

## Phase 8: Testing and Documentation

### Unit Tests
- [ ] **Task 8.1.1**: Set up test framework (Jest or Mocha) if not present
  - **Plan:** 8.1 Unit Tests
  - **Requirements:** All

- [ ] **Task 8.1.2**: Write unit test for downloadImage()
  - **Plan:** 8.1 Unit Tests
  - **Requirements:** REQ-2
  - Mock fetch responses

- [ ] **Task 8.1.3**: Write unit test for processImage()
  - **Plan:** 8.1 Unit Tests
  - **Requirements:** REQ-2
  - Mock Sharp

- [ ] **Task 8.1.4**: Write unit test for uploadToSupabase()
  - **Plan:** 8.1 Unit Tests
  - **Requirements:** REQ-3
  - Mock Supabase client

- [ ] **Task 8.1.5**: Write unit test for extractPrice()
  - **Plan:** 8.1 Unit Tests
  - **Requirements:** REQ-4
  - Test various price formats

- [ ] **Task 8.1.6**: Write unit test for extractArea()
  - **Plan:** 8.1 Unit Tests
  - **Requirements:** REQ-4
  - Test various area formats

- [ ] **Task 8.1.7**: Write unit test for mapListingType()
  - **Plan:** 8.1 Unit Tests
  - **Requirements:** REQ-4
  - Test Macedonian mappings

- [ ] **Task 8.1.8**: Write unit test for classifyPropertyType()
  - **Plan:** 8.1 Unit Tests
  - **Requirements:** REQ-4
  - Mock AI responses

- [ ] **Task 8.1.9**: Write unit test for geocodeAddress()
  - **Plan:** 8.1 Unit Tests
  - **Requirements:** REQ-5
  - Mock geocoding API

- [ ] **Task 8.1.10**: Write unit test for generateExternalId()
  - **Plan:** 8.1 Unit Tests
  - **Requirements:** REQ-7
  - Ensure consistency

- [ ] **Task 8.1.11**: Write unit test for mapToPropertyModel()
  - **Plan:** 8.1 Unit Tests
  - **Requirements:** REQ-8
  - Test all field mappings

### Integration Tests
- [ ] **Task 8.2.1**: Create sample property data fixture for testing
  - **Plan:** 8.2 Integration Tests
  - **Requirements:** All

- [ ] **Task 8.2.2**: Write end-to-end test for full import flow
  - **Plan:** 8.2 Integration Tests
  - **Requirements:** All
  - Use test mode

- [ ] **Task 8.2.3**: Test error scenario: API unavailable
  - **Plan:** 8.2 Integration Tests
  - **Requirements:** REQ-1

- [ ] **Task 8.2.4**: Test error scenario: Image download failures
  - **Plan:** 8.2 Integration Tests
  - **Requirements:** REQ-2

- [ ] **Task 8.2.5**: Test error scenario: AI API failures
  - **Plan:** 8.2 Integration Tests
  - **Requirements:** REQ-4

- [ ] **Task 8.2.6**: Test error scenario: Database errors
  - **Plan:** 8.2 Integration Tests
  - **Requirements:** REQ-8

- [ ] **Task 8.2.7**: Test duplicate handling (same property imported twice)
  - **Plan:** 8.2 Integration Tests
  - **Requirements:** REQ-7

- [ ] **Task 8.2.8**: Test idempotency (running job multiple times)
  - **Plan:** 8.2 Integration Tests
  - **Requirements:** REQ-13

### Documentation
- [ ] **Task 8.3.1**: Write README section for import job overview
  - **Plan:** 8.3 Documentation
  - **Requirements:** REQ-12
  - Explain what it does and how it works

- [ ] **Task 8.3.2**: Document all environment variables in README
  - **Plan:** 8.3 Documentation
  - **Requirements:** REQ-12
  - List with descriptions and defaults

- [ ] **Task 8.3.3**: Document how to run job manually
  - **Plan:** 8.3 Documentation
  - **Requirements:** REQ-12
  - CLI command or API call

- [ ] **Task 8.3.4**: Document how to enable test mode
  - **Plan:** 8.3 Documentation
  - **Requirements:** REQ-15
  - Set IMPORT_TEST_MODE=true

- [ ] **Task 8.3.5**: Create troubleshooting guide
  - **Plan:** 8.3 Documentation
  - **Requirements:** REQ-10
  - Common errors and solutions

- [ ] **Task 8.3.6**: Document JSON field structures (name, description, photos, attributes)
  - **Plan:** 8.3 Documentation
  - **Requirements:** REQ-14
  - Show examples

- [ ] **Task 8.3.7**: Document system user setup requirements
  - **Plan:** 8.3 Documentation
  - **Requirements:** REQ-9
  - How to create and configure

- [ ] **Task 8.3.8**: Add inline code comments for complex logic
  - **Plan:** 8.3 Documentation
  - **Requirements:** All
  - Especially AI prompts, image processing, batch logic

---

## Phase 9: Optimization and Refinement

### Performance Optimization
- [ ] **Task 9.1.1**: Profile job execution to identify bottlenecks
  - **Plan:** 9.1 Performance Optimization
  - **Requirements:** REQ-11
  - Use Node.js profiler

- [ ] **Task 9.1.2**: Optimize image processing for parallel execution
  - **Plan:** 9.1 Performance Optimization
  - **Requirements:** REQ-11
  - Increase concurrency if safe

- [ ] **Task 9.1.3**: Investigate batch insert for database operations
  - **Plan:** 9.1 Performance Optimization
  - **Requirements:** REQ-11
  - Use Prisma createMany if possible

- [ ] **Task 9.1.4**: Implement better caching for geocoding results
  - **Plan:** 9.1 Performance Optimization
  - **Requirements:** REQ-5
  - Use persistent cache (Redis or database)

- [ ] **Task 9.1.5**: Fine-tune batch sizes based on profiling results
  - **Plan:** 9.1 Performance Optimization
  - **Requirements:** REQ-11
  - Adjust IMPORT_BATCH_SIZE default

- [ ] **Task 9.1.6**: Optimize AI API calls (batch prompts if possible)
  - **Plan:** 9.1 Performance Optimization
  - **Requirements:** REQ-4
  - Reduce number of API calls

### Error Recovery
- [ ] **Task 9.2.1**: Implement checkpoint/resume capability
  - **Plan:** 9.2 Error Recovery
  - **Requirements:** REQ-13
  - Save progress periodically

- [ ] **Task 9.2.2**: Store partial progress to allow resumption after failures
  - **Plan:** 9.2 Error Recovery
  - **Requirements:** REQ-13
  - Track last successfully processed property index

- [ ] **Task 9.2.3**: Add manual retry functionality for failed properties
  - **Plan:** 9.2 Error Recovery
  - **Requirements:** REQ-13
  - CLI command or endpoint to retry specific properties

### Monitoring and Alerting
- [ ] **Task 9.3.1**: Integrate with monitoring tools (if available)
  - **Plan:** 9.3 Monitoring and Alerting
  - **Requirements:** REQ-10
  - DataDog, New Relic, etc.

- [ ] **Task 9.3.2**: Set up alerts for high failure rates
  - **Plan:** 9.3 Monitoring and Alerting
  - **Requirements:** REQ-10
  - Email or Slack notification

- [ ] **Task 9.3.3**: Create dashboard for import statistics (optional)
  - **Plan:** 9.3 Monitoring and Alerting
  - **Requirements:** REQ-10
  - Grafana, custom admin panel, etc.

---

## Summary

**Total Tasks:** 231

**By Phase:**
- Phase 1 (Foundation and Setup): 17 tasks
- Phase 2 (Core Data Fetching): 9 tasks
- Phase 3 (Image Processing Pipeline): 30 tasks
- Phase 4 (AI-Based Data Normalization): 50 tasks
- Phase 5 (Property Persistence): 23 tasks
- Phase 6 (Orchestration and Job Execution): 29 tasks
- Phase 7 (Cron Job Integration): 12 tasks
- Phase 8 (Testing and Documentation): 27 tasks
- Phase 9 (Optimization and Refinement): 13 tasks

**Critical Path (High Priority):**
Phases 1-6 (Tasks 1.1.1 through 6.3.8) represent the minimum viable implementation.
