# Requirements Document: Property Import Feature

## Introduction

This document outlines the requirements for an automated property import system that fetches property listings from an external JSON API endpoint, processes images by uploading them to Supabase storage, normalizes data using AI, and stores the properties in the database. The feature enables automated population of the property database from external sources without manual data entry.

---

## Requirements

### 1. External Data Fetching

**User Story:**
> As a system administrator, I want the cron job to automatically fetch property data from the external API so that new listings are continuously imported without manual intervention.

**Acceptance Criteria:**
- WHEN the import job runs THEN the system SHALL fetch data from `https://globalracecalendar.com/imotko/delta.json`
- WHEN the fetch request is made THEN the system SHALL handle network errors gracefully and log failures
- WHEN the API returns data THEN the system SHALL validate the JSON structure before processing
- WHEN the API is unavailable THEN the system SHALL log the error and retry on the next scheduled run
- WHEN data is successfully fetched THEN the system SHALL parse the JSON array of property objects

### 2. Image Download and Processing

**User Story:**
> As a system administrator, I want property images from external URLs to be downloaded and uploaded to our Supabase storage so that we have reliable, permanent copies of all property images.

**Acceptance Criteria:**
- WHEN a property contains an images array THEN the system SHALL download each image from its external URL
- WHEN an image is downloaded THEN the system SHALL process it using Sharp to generate three sizes: small (300px), medium (650px), and large (900px)
- WHEN processing images THEN the system SHALL apply quality compression at 60% for all sizes
- WHEN processing PNG images THEN the system SHALL use compression level 6 and disable adaptive filtering
- WHEN an image download fails THEN the system SHALL log the error and continue processing other images
- WHEN image processing is complete THEN the system SHALL generate unique filenames using UUID and timestamp format: `{uuid}_{timestamp}-{size}.{extension}`

### 3. Supabase Storage Upload

**User Story:**
> As a system administrator, I want processed images to be uploaded to Supabase storage so that they are accessible via public URLs for property listings.

**Acceptance Criteria:**
- WHEN images are processed THEN the system SHALL upload each size variant to the "imotko-prod" bucket
- WHEN uploading to Supabase THEN the system SHALL use the service role key for authentication
- WHEN an upload is successful THEN the system SHALL retrieve and store the public URL for each image size
- WHEN an upload fails THEN the system SHALL log the error with the property identifier and continue processing
- WHEN all images for a property are uploaded THEN the system SHALL create a structured JSON object containing image IDs, size URLs, and storage keys

### 4. Data Normalization with AI

**User Story:**
> As a system administrator, I want the external property data to be normalized using AI so that inconsistent formats, Macedonian text, and missing fields are standardized for database storage.

**Acceptance Criteria:**
- WHEN a property is processed THEN the system SHALL use AI SDK v6 to normalize all data fields
- WHEN normalizing price THEN the system SHALL extract numeric values from strings like "550 ЕУР / месечно" to integers
- WHEN normalizing area THEN the system SHALL extract numeric values from strings like "62 m2" to integers
- WHEN normalizing listingType THEN the system SHALL map Macedonian text ("Се изнајмува" → `for_rent`, "Се продава" → `for_sale`)
- WHEN normalizing property type THEN the system SHALL classify the property based on title and description into enum values (flat, house, land, holiday_home, garage, commercial)
- WHEN the title is in Macedonian THEN the system SHALL structure it as a JSON object for the `name` field
- WHEN the description is in Macedonian THEN the system SHALL structure it as a JSON object for the `description` field
- WHEN AI normalization fails THEN the system SHALL log the error with the property data and skip that property

### 5. Address Geocoding

**User Story:**
> As a system administrator, I want property addresses to be geocoded so that latitude and longitude coordinates are available for map display and location-based searches.

**Acceptance Criteria:**
- WHEN a property has an address or location field THEN the system SHALL use AI or a geocoding service to obtain latitude and longitude
- WHEN geocoding is successful THEN the system SHALL store the coordinates with the property
- WHEN geocoding fails THEN the system SHALL log the error and either skip the property or store it with default coordinates for manual review
- WHEN multiple properties share the same location THEN the system SHALL cache geocoding results to minimize API calls

### 6. Property Location Mapping

**User Story:**
> As a system administrator, I want location text to be mapped to PropertyLocation records so that properties are correctly categorized by location hierarchy.

**Acceptance Criteria:**
- WHEN a property has a location field like "Центар, Скопjе" THEN the system SHALL parse and map it to existing PropertyLocation records
- WHEN a PropertyLocation doesn't exist THEN the system SHALL log a warning and either create it or assign to a default location
- WHEN location parsing is ambiguous THEN the system SHALL use AI to determine the correct PropertyLocation ID

### 7. Duplicate Prevention

**User Story:**
> As a system administrator, I want duplicate properties to be detected and prevented so that the same listing is not imported multiple times.

**Acceptance Criteria:**
- WHEN a property is imported THEN the system SHALL generate a unique external ID based on the source data
- WHEN storing a property THEN the system SHALL check if a property with the same `externalId` already exists
- WHEN a duplicate is detected THEN the system SHALL skip the import and log the duplicate
- WHEN a property has been previously imported but has updated data THEN the system SHALL optionally update the existing record (configurable behavior)

### 8. Database Storage

**User Story:**
> As a system administrator, I want normalized property data to be stored in the database so that it is available for the application to display and manage.

**Acceptance Criteria:**
- WHEN a property is normalized THEN the system SHALL validate all required fields are present
- WHEN required fields are missing THEN the system SHALL log the validation error and skip the property
- WHEN all validations pass THEN the system SHALL create a Property record with `status` set to `PENDING`
- WHEN storing a property THEN the system SHALL set `createdBy` to a designated system user ID
- WHEN storing a property THEN the system SHALL populate all available fields including photos, attributes, and features
- WHEN a database error occurs THEN the system SHALL log the error with property details and continue processing other properties

### 9. System User and Agency Assignment

**User Story:**
> As a system administrator, I want imported properties to be assigned to a system user and optionally a default agency so that ownership and attribution are clear.

**Acceptance Criteria:**
- WHEN the import job initializes THEN the system SHALL verify a system user exists or create one
- WHEN importing properties THEN the system SHALL assign the system user ID to the `createdBy` field
- WHEN a default import agency is configured THEN the system SHALL assign properties to that agency
- WHEN no agency is configured THEN the system SHALL leave `agencyId` as null

### 10. Error Handling and Logging

**User Story:**
> As a system administrator, I want comprehensive error logging so that I can monitor the import process and troubleshoot issues.

**Acceptance Criteria:**
- WHEN the import job starts THEN the system SHALL log the start time and configuration
- WHEN an error occurs at any stage THEN the system SHALL log the error type, message, and affected property data
- WHEN the import job completes THEN the system SHALL log summary statistics: total fetched, successful imports, failed imports, skipped duplicates
- WHEN critical errors occur THEN the system SHALL continue processing remaining properties rather than stopping entirely
- WHEN the job finishes THEN the system SHALL log the completion time and duration

### 11. Batch Processing and Performance

**User Story:**
> As a system administrator, I want properties to be processed in batches so that the import job doesn't overwhelm system resources or external APIs.

**Acceptance Criteria:**
- WHEN processing properties THEN the system SHALL process them in configurable batch sizes (default: 10 properties at a time)
- WHEN processing a batch THEN the system SHALL wait for all properties in the batch to complete before starting the next batch
- WHEN downloading images THEN the system SHALL limit concurrent downloads to prevent resource exhaustion
- WHEN using AI normalization THEN the system SHALL respect rate limits and implement retry logic with exponential backoff

### 12. Configuration and Environment

**User Story:**
> As a system administrator, I want the import job to be configurable via environment variables so that behavior can be adjusted without code changes.

**Acceptance Criteria:**
- WHEN the job initializes THEN the system SHALL read configuration from environment variables
- WHEN Supabase credentials are missing THEN the system SHALL fail with a clear error message
- WHEN AI SDK credentials are missing THEN the system SHALL fail with a clear error message
- WHEN optional configurations are missing THEN the system SHALL use sensible defaults
- WHEN the data source URL is configured THEN the system SHALL use that URL for fetching properties

### 13. Idempotency and Retry Logic

**User Story:**
> As a system administrator, I want the import job to be idempotent and handle failures gracefully so that partial failures don't corrupt data or cause duplicate imports.

**Acceptance Criteria:**
- WHEN the job is run multiple times THEN the system SHALL produce the same results (no duplicate properties)
- WHEN an image upload fails THEN the system SHALL retry up to 3 times with exponential backoff
- WHEN AI normalization fails THEN the system SHALL retry once before logging failure
- WHEN a property import partially completes THEN the system SHALL ensure no partial records are created in the database
- WHEN transactional operations are performed THEN the system SHALL use database transactions to ensure atomicity

### 14. Data Structure and JSON Fields

**User Story:**
> As a system administrator, I want JSON fields (name, description, photos, attributes) to follow a consistent structure so that the application can reliably parse and display the data.

**Acceptance Criteria:**
- WHEN storing the `name` field THEN the system SHALL structure it as `{ "mk": "macedonian title", "en": "english title" }` (if translation available)
- WHEN storing the `description` field THEN the system SHALL structure it as `{ "mk": "macedonian description", "en": "english description" }` (if translation available)
- WHEN storing the `photos` field THEN the system SHALL structure it as an array of objects with `id`, `sizes` (small/medium/large URLs), and `s3Urls` (storage keys)
- WHEN storing the `attributes` field THEN the system SHALL extract and structure features from the source data as key-value pairs
- WHEN features are present in source data THEN the system SHALL map them to the `attributes` JSON field with appropriate keys

### 15. Testing and Validation Mode

**User Story:**
> As a developer, I want a test mode for the import job so that I can validate the implementation without affecting production data.

**Acceptance Criteria:**
- WHEN test mode is enabled THEN the system SHALL process properties but not save to the database
- WHEN test mode is enabled THEN the system SHALL log all normalized data for manual review
- WHEN test mode is enabled THEN the system SHALL optionally skip image uploads to save resources
- WHEN test mode is disabled THEN the system SHALL perform full import with database persistence
- WHEN test mode is enabled THEN the system SHALL clearly indicate in logs that it's running in test mode
