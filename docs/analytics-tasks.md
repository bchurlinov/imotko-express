# Analytics Feature - Technical Task List

**Based on:** `docs/analytics-implementation-plan.md`
**Status:** Not Started
**Started:** -
**Completed:** -

---

## Overview

This document contains the detailed technical tasks for implementing the analytics feature with PostgreSQL materialized views. The feature provides three main analytics capabilities:

1. **Price Trends** - Monthly average prices with YoY change and trend indicators
2. **Price per m²** - Price per square meter by city and property type
3. **Demand Analytics** - Property view statistics aggregated by various dimensions

**Note:** Step 1 (Database Migration) will be executed manually in Supabase SQL terminal and is not included in this task list.

---

## Phase 1: Core Services & Business Logic

**Goal:** Implement the analytics service layer with all data retrieval and processing logic.

**Reference:** `analytics-implementation-plan.md` Step 2 (Lines 124-427)
**Links to:** `[plan.md: TBD]` | `[requirements.md: TBD - Analytics Service Requirements]`

### Task 1.1: Create Analytics Service Directory Structure
- [x] Create directory `src/api/v1/services/analytics/`
- [x] Verify path alias `@services/*` works correctly in jsconfig.json

**Files:** Directory structure
**Estimated Complexity:** Low

---

### Task 1.2: Implement Helper Functions
- [x] Create `src/api/v1/services/analytics/analytics.service.js`
- [x] Implement `getStartDate(range)` helper function
  - [x] Handle '1m' (1 month) range
  - [x] Handle '3m' (3 months) range
  - [x] Handle '6m' (6 months) range
  - [x] Handle '1y' (1 year) range - default
- [x] Add JSDoc type definitions for `TimeRange` typedef

**Reference:** Lines 145-159
**Files:** `src/api/v1/services/analytics/analytics.service.js`
**Estimated Complexity:** Low

---

### Task 1.3: Implement Price Trends Service
- [x] Import Prisma client from `#database/client.js`
- [x] Implement `getPriceTrendsService(params)` function
  - [x] Accept parameters: `locationId`, `listingType`, `propertyType`, `range`
  - [x] Calculate start date based on range
  - [x] Calculate YoY start date (1 year before range start)
  - [x] Build dynamic WHERE clause with parameterized queries
  - [x] Execute raw SQL query on `mv_price_trends` materialized view
  - [x] Calculate YoY change percentage for each month
  - [x] Add trend indicators ('up', 'down', 'stable')
  - [x] Filter results to only include data within the selected range
  - [x] Return formatted response with `{ success, data?, error? }`
- [x] Add JSDoc type definition for `PriceTrendItem` typedef
- [x] Add error handling with console logging

**Reference:** Lines 170-239
**Links to:** `[requirements.md: TBD - Price Trends Requirements]`
**Files:** `src/api/v1/services/analytics/analytics.service.js`
**Estimated Complexity:** High

---

### Task 1.4: Implement Price Per Square Meter Service
- [x] Implement `getPricePerSqmService(params)` function
  - [x] Accept parameters: `locationId`, `listingType`, `propertyType`, `groupBy`
  - [x] Build dynamic WHERE clause with array-based conditions
  - [x] Support `groupBy` parameter ('city' or 'type')
  - [x] Execute raw SQL query on `mv_price_per_sqm` materialized view
  - [x] When grouped by 'city', fetch location names from `PropertyLocation` table
  - [x] Map location IDs to location names
  - [x] Return formatted response with `{ success, data?, error? }`
- [x] Add error handling with console logging

**Reference:** Lines 250-314
**Links to:** `[requirements.md: TBD - Price Per SQM Requirements]`
**Files:** `src/api/v1/services/analytics/analytics.service.js`
**Estimated Complexity:** Medium

---

### Task 1.5: Implement Demand Analytics Service
- [x] Implement `getDemandAnalyticsService(params)` function
  - [x] Accept parameters: `locationId`, `listingType`, `propertyType`, `categoryId`, `range`
  - [x] Calculate start date based on range
  - [x] Build dynamic WHERE clause with all filter conditions
  - [x] Execute raw SQL query on `mv_property_views` materialized view
  - [x] Aggregate view counts and unique properties viewed by month
  - [x] Return formatted response with `{ success, data?, error? }`
- [x] Add error handling with console logging

**Reference:** Lines 326-374
**Links to:** `[requirements.md: TBD - Demand Analytics Requirements]`
**Files:** `src/api/v1/services/analytics/analytics.service.js`
**Estimated Complexity:** Medium

---

### Task 1.6: Implement Property-Specific Views Service
- [x] Implement `getPropertyViewsService(propertyId, range)` function
  - [x] Accept parameters: `propertyId` (required), `range` (optional, default '1y')
  - [x] Calculate start date based on range
  - [x] Query `mv_property_views_per_listing` for monthly view counts
  - [x] Query total views for the property (all time)
  - [x] Return formatted response with monthly breakdown and total views
  - [x] Return `{ success, data: { monthly, total_views } }`
- [x] Add error handling with console logging

**Reference:** Lines 382-412
**Links to:** `[requirements.md: TBD - Property Views Requirements]`
**Files:** `src/api/v1/services/analytics/analytics.service.js`
**Estimated Complexity:** Medium

---

### Task 1.7: Implement Refresh Analytics Service
- [x] Implement `refreshAnalyticsViewsService()` function (admin only)
  - [x] Execute PostgreSQL function `refresh_analytics_views()` via raw SQL
  - [x] Return formatted response with `{ success, error? }`
- [x] Add error handling with console logging

**Reference:** Lines 418-426
**Links to:** `[requirements.md: TBD - Admin Refresh Requirements]`
**Files:** `src/api/v1/services/analytics/analytics.service.js`
**Estimated Complexity:** Low

---

### Task 1.8: Add JSDoc Documentation
- [x] Add comprehensive JSDoc comments for all service functions
- [x] Document all parameters with types and descriptions
- [x] Document return types with Promise wrappers
- [x] Add usage examples in comments where helpful

**Reference:** Lines 132-144, and throughout Step 2
**Files:** `src/api/v1/services/analytics/analytics.service.js`
**Estimated Complexity:** Low

---

## Phase 2: Controllers Layer

**Goal:** Create controller functions to handle HTTP requests and responses.

**Reference:** `analytics-implementation-plan.md` Step 3 (Lines 429-548)
**Links to:** `[plan.md: TBD]` | `[requirements.md: TBD - Controllers Requirements]`

### Task 2.1: Create Analytics Controller Directory Structure
- [x] Create directory `src/api/v1/controllers/analytics/`
- [x] Verify path alias `@controllers/*` works correctly

**Files:** Directory structure
**Estimated Complexity:** Low

---

### Task 2.2: Implement Price Trends Controller
- [x] Create `src/api/v1/controllers/analytics/analytics.controller.js`
- [x] Import all service functions from `#services/analytics/analytics.service.js`
- [x] Implement `getPriceTrendsController(req, res, next)` function
  - [x] Extract query parameters: `locationId`, `listingType`, `propertyType`, `range`
  - [x] Call `getPriceTrendsService()` with extracted parameters
  - [x] Handle error response (status 500) if service returns error
  - [x] Send JSON response with data on success
  - [x] Pass errors to Express error handler via `next(error)`
- [x] Add JSDoc type annotations for Express types

**Reference:** Lines 447-462
**Files:** `src/api/v1/controllers/analytics/analytics.controller.js`
**Estimated Complexity:** Low

---

### Task 2.3: Implement Price Per SQM Controller
- [x] Implement `getPricePerSqmController(req, res, next)` function
  - [x] Extract query parameters: `locationId`, `listingType`, `propertyType`, `groupBy`
  - [x] Call `getPricePerSqmService()` with extracted parameters
  - [x] Handle error response (status 500) if service returns error
  - [x] Send JSON response with data on success
  - [x] Pass errors to Express error handler via `next(error)`
- [x] Add JSDoc type annotations

**Reference:** Lines 469-484
**Files:** `src/api/v1/controllers/analytics/analytics.controller.js`
**Estimated Complexity:** Low

---

### Task 2.4: Implement Demand Analytics Controller
- [x] Implement `getDemandAnalyticsController(req, res, next)` function
  - [x] Extract query parameters: `locationId`, `listingType`, `propertyType`, `categoryId`, `range`
  - [x] Call `getDemandAnalyticsService()` with extracted parameters
  - [x] Handle error response (status 500) if service returns error
  - [x] Send JSON response with data on success
  - [x] Pass errors to Express error handler via `next(error)`
- [x] Add JSDoc type annotations

**Reference:** Lines 491-506
**Files:** `src/api/v1/controllers/analytics/analytics.controller.js`
**Estimated Complexity:** Low

---

### Task 2.5: Implement Property Views Controller
- [x] Implement `getPropertyViewsController(req, res, next)` function
  - [x] Extract route parameter: `id` from `req.params`
  - [x] Extract query parameter: `range`
  - [x] Call `getPropertyViewsService(id, range)` with extracted parameters
  - [x] Handle error response (status 500) if service returns error
  - [x] Send JSON response with data on success
  - [x] Pass errors to Express error handler via `next(error)`
- [x] Add JSDoc type annotations

**Reference:** Lines 513-527
**Files:** `src/api/v1/controllers/analytics/analytics.controller.js`
**Estimated Complexity:** Low

---

### Task 2.6: Implement Refresh Analytics Controller (Admin Only)
- [x] Implement `refreshAnalyticsController(req, res, next)` function
  - [x] Call `refreshAnalyticsViewsService()`
  - [x] Handle error response (status 500) if service returns error
  - [x] Send success message JSON response
  - [x] Pass errors to Express error handler via `next(error)`
- [x] Add JSDoc type annotations
- [x] Add comment indicating this is admin-only endpoint

**Reference:** Lines 535-547
**Files:** `src/api/v1/controllers/analytics/analytics.controller.js`
**Estimated Complexity:** Low

---

## Phase 3: Routes & Validation

**Goal:** Define API routes with validation rules and middleware.

**Reference:** `analytics-implementation-plan.md` Step 4 (Lines 550-648)
**Links to:** `[plan.md: TBD]` | `[requirements.md: TBD - API Endpoints Requirements]`

### Task 3.1: Create Analytics Routes Directory Structure
- [x] Create directory `src/api/v1/routes/analytics/`
- [x] Verify path alias `@routes/*` works correctly

**Files:** Directory structure
**Estimated Complexity:** Low

---

### Task 3.2: Set Up Route File and Imports
- [x] Create `src/api/v1/routes/analytics/analytics.routes.js`
- [x] Import `Router` from Express
- [x] Import `query`, `param` from `express-validator`
- [x] Import `validateRequest` middleware from `#middlewares/validate_request.js`
- [x] Import `verifySupabaseToken` middleware from `#middlewares/verifySupabaseToken.js`
- [x] Import all controller functions from `#controllers/analytics/analytics.controller.js`
- [x] Initialize Express Router

**Reference:** Lines 555-567
**Files:** `src/api/v1/routes/analytics/analytics.routes.js`
**Estimated Complexity:** Low

---

### Task 3.3: Define Reusable Validation Rules
- [x] Create `rangeValidation` - validates `range` query parameter
  - [x] Make optional
  - [x] Allow only: '1m', '3m', '6m', '1y'
  - [x] Add custom error message
- [x] Create `listingTypeValidation` - validates `listingType` query parameter
  - [x] Make optional
  - [x] Allow only: 'for_rent', 'for_sale'
  - [x] Add custom error message
- [x] Create `propertyTypeValidation` - validates `propertyType` query parameter
  - [x] Make optional
  - [x] Allow only: 'flat', 'house', 'land', 'holiday_home', 'garage', 'commercial'
  - [x] Add custom error message
- [x] Create `groupByValidation` - validates `groupBy` query parameter
  - [x] Make optional
  - [x] Allow only: 'city', 'type'
  - [x] Add custom error message

**Reference:** Lines 569-587
**Files:** `src/api/v1/routes/analytics/analytics.routes.js`
**Estimated Complexity:** Low

---

### Task 3.4: Define Price Trends Route
- [x] Create GET route `/price-trends`
- [x] Add validation middleware array:
  - [x] `rangeValidation`
  - [x] `listingTypeValidation`
  - [x] `propertyTypeValidation`
  - [x] `query('locationId').optional().isString().trim()`
- [x] Add `validateRequest` middleware
- [x] Add `getPriceTrendsController` handler
- [x] Route should be publicly accessible (no auth)

**Reference:** Lines 590-600
**Links to:** `[requirements.md: TBD - GET /price-trends Endpoint]`
**Files:** `src/api/v1/routes/analytics/analytics.routes.js`
**Estimated Complexity:** Low

---

### Task 3.5: Define Price Per SQM Route
- [x] Create GET route `/price-per-sqm`
- [x] Add validation middleware array:
  - [x] `listingTypeValidation`
  - [x] `propertyTypeValidation`
  - [x] `groupByValidation`
  - [x] `query('locationId').optional().isString().trim()`
- [x] Add `validateRequest` middleware
- [x] Add `getPricePerSqmController` handler
- [x] Route should be publicly accessible (no auth)

**Reference:** Lines 603-613
**Links to:** `[requirements.md: TBD - GET /price-per-sqm Endpoint]`
**Files:** `src/api/v1/routes/analytics/analytics.routes.js`
**Estimated Complexity:** Low

---

### Task 3.6: Define Demand Analytics Route
- [x] Create GET route `/demand`
- [x] Add validation middleware array:
  - [x] `rangeValidation`
  - [x] `listingTypeValidation`
  - [x] `propertyTypeValidation`
  - [x] `query('locationId').optional().isString().trim()`
  - [x] `query('categoryId').optional().isString().trim()`
- [x] Add `validateRequest` middleware
- [x] Add `getDemandAnalyticsController` handler
- [x] Route should be publicly accessible (no auth)

**Reference:** Lines 616-627
**Links to:** `[requirements.md: TBD - GET /demand Endpoint]`
**Files:** `src/api/v1/routes/analytics/analytics.routes.js`
**Estimated Complexity:** Low

---

### Task 3.7: Define Property-Specific Views Route
- [x] Create GET route `/demand/:id`
- [x] Add validation middleware array:
  - [x] `param('id').notEmpty().withMessage('Property ID is required').trim()`
  - [x] `rangeValidation`
- [x] Add `validateRequest` middleware
- [x] Add `getPropertyViewsController` handler
- [x] Route should be publicly accessible (no auth)

**Reference:** Lines 630-638
**Links to:** `[requirements.md: TBD - GET /demand/:id Endpoint]`
**Files:** `src/api/v1/routes/analytics/analytics.routes.js`
**Estimated Complexity:** Low

---

### Task 3.8: Define Admin Refresh Route
- [x] Create POST route `/refresh`
- [x] Add `verifySupabaseToken` middleware (authentication required)
- [x] Add `refreshAnalyticsController` handler
- [x] Route should require authentication (admin only)
- [x] **Note:** Consider adding additional admin role check middleware

**Reference:** Lines 641-645
**Links to:** `[requirements.md: TBD - POST /refresh Endpoint]`
**Files:** `src/api/v1/routes/analytics/analytics.routes.js`
**Estimated Complexity:** Medium

---

### Task 3.9: Export Router
- [x] Export the configured router as default export

**Reference:** Line 647
**Files:** `src/api/v1/routes/analytics/analytics.routes.js`
**Estimated Complexity:** Low

---

## Phase 4: Integration & Registration

**Goal:** Register analytics routes with the main application router.

**Reference:** `analytics-implementation-plan.md` Step 5 (Lines 650-662)
**Links to:** `[plan.md: TBD]` | `[requirements.md: TBD - Route Registration]`

### Task 4.1: Update Main Routes Index
- [x] Open `src/api/v1/routes/index.js`
- [x] Import analytics routes: `import analyticsRoutes from "./analytics/analytics.routes.js"`
- [x] Register analytics routes: `router.use("/analytics", analyticsRoutes)`
- [x] Verify the route prefix creates endpoints under `/api/v1/analytics`

**Reference:** Lines 656-662
**Files:** `src/api/v1/routes/index.js`
**Estimated Complexity:** Low

---

### Task 4.2: Verify Route Registration
- [ ] Start the development server (`npm run dev`)
- [ ] Check server logs for any import or registration errors
- [ ] Verify no conflicts with existing routes
- [ ] Confirm analytics routes are loaded

**Files:** Server startup
**Estimated Complexity:** Low

---

## Phase 5: Scheduled Jobs (Optional)

**Goal:** Implement automated refresh of materialized views.

**Reference:** `analytics-implementation-plan.md` Step 6 (Lines 664-709)
**Links to:** `[plan.md: TBD]` | `[requirements.md: TBD - Automated Refresh Requirements]`

### Task 5.1: Install node-cron Dependency
- [x] Run `npm install node-cron`
- [x] Verify installation in `package.json`

**Reference:** Lines 817-819
**Files:** `package.json`
**Estimated Complexity:** Low

---

### Task 5.2: Create Jobs Directory
- [x] Create directory `src/jobs/` (if it doesn't exist)

**Files:** Directory structure
**Estimated Complexity:** Low

---

### Task 5.3: Implement Analytics Refresh Job
- [x] Create `src/jobs/refreshAnalytics.js`
- [x] Import `cron` from `node-cron`
- [x] Import Prisma client from `#database/client.js`
- [x] Implement `scheduleAnalyticsRefresh()` function
  - [x] Schedule cron job to run every 30 minutes: `*/30 * * * *`
  - [x] Execute `refresh_analytics_views()` PostgreSQL function
  - [x] Add console logging for start and success
  - [x] Add error handling with console logging
- [x] Export `scheduleAnalyticsRefresh` function

**Reference:** Lines 672-688
**Files:** `src/jobs/refreshAnalytics.js`
**Estimated Complexity:** Medium

---

### Task 5.4: Register Job in Application
- [x] Open `src/app.js`
- [x] Import refresh job: `import { scheduleAnalyticsRefresh } from './jobs/refreshAnalytics.js'`
- [x] Call `scheduleAnalyticsRefresh()` after `app.listen()`
- [x] **Consider:** Only enable in production: `if (process.env.NODE_ENV === 'production')`

**Reference:** Lines 690-701
**Files:** `src/app.js`
**Estimated Complexity:** Low

---

### Task 5.5: Document Alternative Refresh Strategies
- [x] Add comment in code about pg_cron option (for Supabase/PostgreSQL extension)
- [x] Add comment about system cron job option
- [x] Add comment about cloud scheduler option (for cloud deployments)

**Reference:** Lines 703-709
**Files:** `src/jobs/refreshAnalytics.js` (comments)
**Estimated Complexity:** Low

---

## Phase 6: Testing & Verification

**Goal:** Test all endpoints and verify functionality.

**Reference:** `analytics-implementation-plan.md` (General testing considerations)
**Links to:** `[plan.md: TBD]` | `[requirements.md: TBD - Testing Requirements]`

### Task 6.1: Test Price Trends Endpoint
- [ ] Test GET `/api/v1/analytics/price-trends` without parameters (default: 1 year)
- [ ] Test with `range` parameter: `?range=1m`, `?range=3m`, `?range=6m`, `?range=1y`
- [ ] Test with `locationId` filter
- [ ] Test with `listingType` filter: `?listingType=for_rent`, `?listingType=for_sale`
- [ ] Test with `propertyType` filter: `?propertyType=flat`, `?propertyType=house`, etc.
- [ ] Test with multiple filters combined
- [ ] Verify response format matches expected structure (Lines 740-759)
- [ ] Verify YoY percentage calculation is correct
- [ ] Verify trend indicators ('up', 'down', 'stable')
- [ ] Test with invalid parameters and verify validation errors

**Reference:** Lines 738-759
**Estimated Complexity:** High

---

### Task 6.2: Test Price Per SQM Endpoint
- [ ] Test GET `/api/v1/analytics/price-per-sqm` without parameters
- [ ] Test with `groupBy=city`
- [ ] Test with `groupBy=type`
- [ ] Test with `locationId` filter
- [ ] Test with `listingType` filter
- [ ] Test with `propertyType` filter
- [ ] Test with multiple filters combined
- [ ] Verify response format matches expected structure (Lines 761-786)
- [ ] Verify location names are populated when grouping by city
- [ ] Test with invalid parameters and verify validation errors

**Reference:** Lines 761-786
**Estimated Complexity:** Medium

---

### Task 6.3: Test Demand Analytics Endpoint
- [ ] Test GET `/api/v1/analytics/demand` without parameters
- [ ] Test with `range` parameter variations
- [ ] Test with `locationId` filter
- [ ] Test with `listingType` filter
- [ ] Test with `propertyType` filter
- [ ] Test with `categoryId` filter
- [ ] Test with multiple filters combined
- [ ] Verify monthly aggregation is correct
- [ ] Verify view counts and unique properties viewed
- [ ] Test with invalid parameters and verify validation errors

**Estimated Complexity:** Medium

---

### Task 6.4: Test Property-Specific Views Endpoint
- [ ] Test GET `/api/v1/analytics/demand/:id` with valid property ID
- [ ] Test with `range` parameter variations
- [ ] Verify monthly breakdown is returned
- [ ] Verify total views (all time) is calculated correctly
- [ ] Test with non-existent property ID
- [ ] Test with invalid property ID format
- [ ] Verify validation errors for missing ID

**Estimated Complexity:** Medium

---

### Task 6.5: Test Admin Refresh Endpoint
- [ ] Test POST `/api/v1/analytics/refresh` without authentication (should fail)
- [ ] Test with valid Supabase authentication token
- [ ] Verify materialized views are refreshed
- [ ] Verify success response message
- [ ] Check database to confirm view data is updated
- [ ] Test error handling if database refresh fails

**Estimated Complexity:** Medium

---

### Task 6.6: Test Scheduled Job (If Implemented)
- [ ] Verify cron job is registered on server startup
- [ ] Check logs to confirm scheduled execution
- [ ] Wait for scheduled interval (30 min) and verify automatic refresh
- [ ] Verify refresh errors are logged correctly
- [ ] Test job behavior on server restart

**Estimated Complexity:** Low

---

### Task 6.7: Performance Testing
- [ ] Measure response times for all endpoints without filters
- [ ] Measure response times with various filter combinations
- [ ] Compare materialized view query performance to direct table queries
- [ ] Verify response times are under 100ms for typical queries
- [ ] Test with large date ranges (1 year vs 1 month)
- [ ] Identify any slow queries and optimize if needed

**Estimated Complexity:** Medium

---

### Task 6.8: Data Accuracy Verification
- [ ] Manually verify price trend calculations against raw data
- [ ] Verify YoY percentage changes are mathematically correct
- [ ] Verify price per SQM calculations match expected formulas
- [ ] Verify view counts match PropertyView table data
- [ ] Check for any missing or incorrect data in materialized views
- [ ] Verify aggregations handle NULL values correctly

**Estimated Complexity:** Medium

---

## Phase 7: Documentation & Cleanup

**Goal:** Document the implementation and ensure code quality.

**Reference:** `analytics-implementation-plan.md` (Throughout)
**Links to:** `[plan.md: TBD]` | `[requirements.md: TBD]`

### Task 7.1: Update API Documentation
- [ ] Document all analytics endpoints in project documentation
- [ ] Create/update API endpoint summary table (Reference: Lines 710-719)
- [ ] Document all query parameters (Reference: Lines 720-735)
- [ ] Add example API requests and responses
- [ ] Document authentication requirements for each endpoint
- [ ] Document error response formats

**Reference:** Lines 710-786
**Estimated Complexity:** Medium

---

### Task 7.2: Add Code Comments
- [ ] Review all service functions for adequate documentation
- [ ] Add inline comments for complex SQL queries
- [ ] Document YoY calculation logic
- [ ] Document location name mapping logic
- [ ] Add comments explaining refresh strategy decisions

**Estimated Complexity:** Low

---

### Task 7.3: Code Quality Review
- [ ] Run Prettier formatter: `npx prettier --write .`
- [ ] Check for unused imports
- [ ] Verify consistent error handling patterns
- [ ] Ensure all async functions have try-catch blocks
- [ ] Verify JSDoc types are accurate and complete
- [ ] Check for any hardcoded values that should be configurable

**Estimated Complexity:** Medium

---

### Task 7.4: Update CLAUDE.md (If Applicable)
- [ ] Add analytics feature to project overview
- [ ] Document materialized views approach
- [ ] Document analytics service patterns
- [ ] Add notes about scheduled jobs (if implemented)
- [ ] Update architecture section with analytics endpoints

**Files:** `/CLAUDE.md`
**Estimated Complexity:** Low

---

### Task 7.5: Create Implementation Notes
- [ ] Document any deviations from the original plan
- [ ] Document known limitations or edge cases
- [ ] Document scaling considerations (Reference: Lines 846-856)
- [ ] Document data freshness implications (Reference: Lines 840-845)
- [ ] Add notes about future enhancements or improvements

**Reference:** Lines 832-856
**Estimated Complexity:** Low

---

## Summary

### Total Tasks: 88

**Phase Breakdown:**
- Phase 1 (Core Services): 8 tasks
- Phase 2 (Controllers): 6 tasks
- Phase 3 (Routes & Validation): 9 tasks
- Phase 4 (Integration): 2 tasks
- Phase 5 (Scheduled Jobs): 5 tasks (Optional)
- Phase 6 (Testing): 8 tasks
- Phase 7 (Documentation): 5 tasks

### Critical Path Tasks
1. Task 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 1.7 (Services must be implemented sequentially)
2. Task 2.1 → 2.2-2.6 (Controllers depend on services)
3. Task 3.1 → 3.2 → 3.3 → 3.4-3.9 (Routes depend on controllers)
4. Task 4.1 → 4.2 (Integration depends on routes)
5. Task 6.1-6.8 (Testing depends on all above)

### Dependencies
- **External:** `node-cron` package (Phase 5)
- **Internal:** Prisma client, Express middlewares, express-validator
- **Database:** Materialized views must be created first (Step 1 - Manual)

### References to Complete After Implementation
- [ ] Link tasks to `docs/plan.md` once created
- [ ] Link tasks to `docs/requirements.md` once created
- [ ] Update cross-references between documents

---

**Notes:**
- Step 1 (Database Migration) is excluded as it will be executed manually in Supabase SQL terminal
- All tasks reference the `analytics-implementation-plan.md` document
- Placeholders for `plan.md` and `requirements.md` are included for future linking
- Estimated complexity is subjective and based on typical development experience
