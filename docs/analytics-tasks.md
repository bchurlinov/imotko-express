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
- [ ] Create directory `src/api/v1/services/analytics/`
- [ ] Verify path alias `@services/*` works correctly in jsconfig.json

**Files:** Directory structure
**Estimated Complexity:** Low

---

### Task 1.2: Implement Helper Functions
- [ ] Create `src/api/v1/services/analytics/analytics.service.js`
- [ ] Implement `getStartDate(range)` helper function
  - [ ] Handle '1m' (1 month) range
  - [ ] Handle '3m' (3 months) range
  - [ ] Handle '6m' (6 months) range
  - [ ] Handle '1y' (1 year) range - default
- [ ] Add JSDoc type definitions for `TimeRange` typedef

**Reference:** Lines 145-159
**Files:** `src/api/v1/services/analytics/analytics.service.js`
**Estimated Complexity:** Low

---

### Task 1.3: Implement Price Trends Service
- [ ] Import Prisma client from `#database/client.js`
- [ ] Implement `getPriceTrendsService(params)` function
  - [ ] Accept parameters: `locationId`, `listingType`, `propertyType`, `range`
  - [ ] Calculate start date based on range
  - [ ] Calculate YoY start date (1 year before range start)
  - [ ] Build dynamic WHERE clause with parameterized queries
  - [ ] Execute raw SQL query on `mv_price_trends` materialized view
  - [ ] Calculate YoY change percentage for each month
  - [ ] Add trend indicators ('up', 'down', 'stable')
  - [ ] Filter results to only include data within the selected range
  - [ ] Return formatted response with `{ success, data?, error? }`
- [ ] Add JSDoc type definition for `PriceTrendItem` typedef
- [ ] Add error handling with console logging

**Reference:** Lines 170-239
**Links to:** `[requirements.md: TBD - Price Trends Requirements]`
**Files:** `src/api/v1/services/analytics/analytics.service.js`
**Estimated Complexity:** High

---

### Task 1.4: Implement Price Per Square Meter Service
- [ ] Implement `getPricePerSqmService(params)` function
  - [ ] Accept parameters: `locationId`, `listingType`, `propertyType`, `groupBy`
  - [ ] Build dynamic WHERE clause with array-based conditions
  - [ ] Support `groupBy` parameter ('city' or 'type')
  - [ ] Execute raw SQL query on `mv_price_per_sqm` materialized view
  - [ ] When grouped by 'city', fetch location names from `PropertyLocation` table
  - [ ] Map location IDs to location names
  - [ ] Return formatted response with `{ success, data?, error? }`
- [ ] Add error handling with console logging

**Reference:** Lines 250-314
**Links to:** `[requirements.md: TBD - Price Per SQM Requirements]`
**Files:** `src/api/v1/services/analytics/analytics.service.js`
**Estimated Complexity:** Medium

---

### Task 1.5: Implement Demand Analytics Service
- [ ] Implement `getDemandAnalyticsService(params)` function
  - [ ] Accept parameters: `locationId`, `listingType`, `propertyType`, `categoryId`, `range`
  - [ ] Calculate start date based on range
  - [ ] Build dynamic WHERE clause with all filter conditions
  - [ ] Execute raw SQL query on `mv_property_views` materialized view
  - [ ] Aggregate view counts and unique properties viewed by month
  - [ ] Return formatted response with `{ success, data?, error? }`
- [ ] Add error handling with console logging

**Reference:** Lines 326-374
**Links to:** `[requirements.md: TBD - Demand Analytics Requirements]`
**Files:** `src/api/v1/services/analytics/analytics.service.js`
**Estimated Complexity:** Medium

---

### Task 1.6: Implement Property-Specific Views Service
- [ ] Implement `getPropertyViewsService(propertyId, range)` function
  - [ ] Accept parameters: `propertyId` (required), `range` (optional, default '1y')
  - [ ] Calculate start date based on range
  - [ ] Query `mv_property_views_per_listing` for monthly view counts
  - [ ] Query total views for the property (all time)
  - [ ] Return formatted response with monthly breakdown and total views
  - [ ] Return `{ success, data: { monthly, total_views } }`
- [ ] Add error handling with console logging

**Reference:** Lines 382-412
**Links to:** `[requirements.md: TBD - Property Views Requirements]`
**Files:** `src/api/v1/services/analytics/analytics.service.js`
**Estimated Complexity:** Medium

---

### Task 1.7: Implement Refresh Analytics Service
- [ ] Implement `refreshAnalyticsViewsService()` function (admin only)
  - [ ] Execute PostgreSQL function `refresh_analytics_views()` via raw SQL
  - [ ] Return formatted response with `{ success, error? }`
- [ ] Add error handling with console logging

**Reference:** Lines 418-426
**Links to:** `[requirements.md: TBD - Admin Refresh Requirements]`
**Files:** `src/api/v1/services/analytics/analytics.service.js`
**Estimated Complexity:** Low

---

### Task 1.8: Add JSDoc Documentation
- [ ] Add comprehensive JSDoc comments for all service functions
- [ ] Document all parameters with types and descriptions
- [ ] Document return types with Promise wrappers
- [ ] Add usage examples in comments where helpful

**Reference:** Lines 132-144, and throughout Step 2
**Files:** `src/api/v1/services/analytics/analytics.service.js`
**Estimated Complexity:** Low

---

## Phase 2: Controllers Layer

**Goal:** Create controller functions to handle HTTP requests and responses.

**Reference:** `analytics-implementation-plan.md` Step 3 (Lines 429-548)
**Links to:** `[plan.md: TBD]` | `[requirements.md: TBD - Controllers Requirements]`

### Task 2.1: Create Analytics Controller Directory Structure
- [ ] Create directory `src/api/v1/controllers/analytics/`
- [ ] Verify path alias `@controllers/*` works correctly

**Files:** Directory structure
**Estimated Complexity:** Low

---

### Task 2.2: Implement Price Trends Controller
- [ ] Create `src/api/v1/controllers/analytics/analytics.controller.js`
- [ ] Import all service functions from `#services/analytics/analytics.service.js`
- [ ] Implement `getPriceTrendsController(req, res, next)` function
  - [ ] Extract query parameters: `locationId`, `listingType`, `propertyType`, `range`
  - [ ] Call `getPriceTrendsService()` with extracted parameters
  - [ ] Handle error response (status 500) if service returns error
  - [ ] Send JSON response with data on success
  - [ ] Pass errors to Express error handler via `next(error)`
- [ ] Add JSDoc type annotations for Express types

**Reference:** Lines 447-462
**Files:** `src/api/v1/controllers/analytics/analytics.controller.js`
**Estimated Complexity:** Low

---

### Task 2.3: Implement Price Per SQM Controller
- [ ] Implement `getPricePerSqmController(req, res, next)` function
  - [ ] Extract query parameters: `locationId`, `listingType`, `propertyType`, `groupBy`
  - [ ] Call `getPricePerSqmService()` with extracted parameters
  - [ ] Handle error response (status 500) if service returns error
  - [ ] Send JSON response with data on success
  - [ ] Pass errors to Express error handler via `next(error)`
- [ ] Add JSDoc type annotations

**Reference:** Lines 469-484
**Files:** `src/api/v1/controllers/analytics/analytics.controller.js`
**Estimated Complexity:** Low

---

### Task 2.4: Implement Demand Analytics Controller
- [ ] Implement `getDemandAnalyticsController(req, res, next)` function
  - [ ] Extract query parameters: `locationId`, `listingType`, `propertyType`, `categoryId`, `range`
  - [ ] Call `getDemandAnalyticsService()` with extracted parameters
  - [ ] Handle error response (status 500) if service returns error
  - [ ] Send JSON response with data on success
  - [ ] Pass errors to Express error handler via `next(error)`
- [ ] Add JSDoc type annotations

**Reference:** Lines 491-506
**Files:** `src/api/v1/controllers/analytics/analytics.controller.js`
**Estimated Complexity:** Low

---

### Task 2.5: Implement Property Views Controller
- [ ] Implement `getPropertyViewsController(req, res, next)` function
  - [ ] Extract route parameter: `id` from `req.params`
  - [ ] Extract query parameter: `range`
  - [ ] Call `getPropertyViewsService(id, range)` with extracted parameters
  - [ ] Handle error response (status 500) if service returns error
  - [ ] Send JSON response with data on success
  - [ ] Pass errors to Express error handler via `next(error)`
- [ ] Add JSDoc type annotations

**Reference:** Lines 513-527
**Files:** `src/api/v1/controllers/analytics/analytics.controller.js`
**Estimated Complexity:** Low

---

### Task 2.6: Implement Refresh Analytics Controller (Admin Only)
- [ ] Implement `refreshAnalyticsController(req, res, next)` function
  - [ ] Call `refreshAnalyticsViewsService()`
  - [ ] Handle error response (status 500) if service returns error
  - [ ] Send success message JSON response
  - [ ] Pass errors to Express error handler via `next(error)`
- [ ] Add JSDoc type annotations
- [ ] Add comment indicating this is admin-only endpoint

**Reference:** Lines 535-547
**Files:** `src/api/v1/controllers/analytics/analytics.controller.js`
**Estimated Complexity:** Low

---

## Phase 3: Routes & Validation

**Goal:** Define API routes with validation rules and middleware.

**Reference:** `analytics-implementation-plan.md` Step 4 (Lines 550-648)
**Links to:** `[plan.md: TBD]` | `[requirements.md: TBD - API Endpoints Requirements]`

### Task 3.1: Create Analytics Routes Directory Structure
- [ ] Create directory `src/api/v1/routes/analytics/`
- [ ] Verify path alias `@routes/*` works correctly

**Files:** Directory structure
**Estimated Complexity:** Low

---

### Task 3.2: Set Up Route File and Imports
- [ ] Create `src/api/v1/routes/analytics/analytics.routes.js`
- [ ] Import `Router` from Express
- [ ] Import `query`, `param` from `express-validator`
- [ ] Import `validateRequest` middleware from `#middlewares/validate_request.js`
- [ ] Import `verifySupabaseToken` middleware from `#middlewares/verifySupabaseToken.js`
- [ ] Import all controller functions from `#controllers/analytics/analytics.controller.js`
- [ ] Initialize Express Router

**Reference:** Lines 555-567
**Files:** `src/api/v1/routes/analytics/analytics.routes.js`
**Estimated Complexity:** Low

---

### Task 3.3: Define Reusable Validation Rules
- [ ] Create `rangeValidation` - validates `range` query parameter
  - [ ] Make optional
  - [ ] Allow only: '1m', '3m', '6m', '1y'
  - [ ] Add custom error message
- [ ] Create `listingTypeValidation` - validates `listingType` query parameter
  - [ ] Make optional
  - [ ] Allow only: 'for_rent', 'for_sale'
  - [ ] Add custom error message
- [ ] Create `propertyTypeValidation` - validates `propertyType` query parameter
  - [ ] Make optional
  - [ ] Allow only: 'flat', 'house', 'land', 'holiday_home', 'garage', 'commercial'
  - [ ] Add custom error message
- [ ] Create `groupByValidation` - validates `groupBy` query parameter
  - [ ] Make optional
  - [ ] Allow only: 'city', 'type'
  - [ ] Add custom error message

**Reference:** Lines 569-587
**Files:** `src/api/v1/routes/analytics/analytics.routes.js`
**Estimated Complexity:** Low

---

### Task 3.4: Define Price Trends Route
- [ ] Create GET route `/price-trends`
- [ ] Add validation middleware array:
  - [ ] `rangeValidation`
  - [ ] `listingTypeValidation`
  - [ ] `propertyTypeValidation`
  - [ ] `query('locationId').optional().isString().trim()`
- [ ] Add `validateRequest` middleware
- [ ] Add `getPriceTrendsController` handler
- [ ] Route should be publicly accessible (no auth)

**Reference:** Lines 590-600
**Links to:** `[requirements.md: TBD - GET /price-trends Endpoint]`
**Files:** `src/api/v1/routes/analytics/analytics.routes.js`
**Estimated Complexity:** Low

---

### Task 3.5: Define Price Per SQM Route
- [ ] Create GET route `/price-per-sqm`
- [ ] Add validation middleware array:
  - [ ] `listingTypeValidation`
  - [ ] `propertyTypeValidation`
  - [ ] `groupByValidation`
  - [ ] `query('locationId').optional().isString().trim()`
- [ ] Add `validateRequest` middleware
- [ ] Add `getPricePerSqmController` handler
- [ ] Route should be publicly accessible (no auth)

**Reference:** Lines 603-613
**Links to:** `[requirements.md: TBD - GET /price-per-sqm Endpoint]`
**Files:** `src/api/v1/routes/analytics/analytics.routes.js`
**Estimated Complexity:** Low

---

### Task 3.6: Define Demand Analytics Route
- [ ] Create GET route `/demand`
- [ ] Add validation middleware array:
  - [ ] `rangeValidation`
  - [ ] `listingTypeValidation`
  - [ ] `propertyTypeValidation`
  - [ ] `query('locationId').optional().isString().trim()`
  - [ ] `query('categoryId').optional().isString().trim()`
- [ ] Add `validateRequest` middleware
- [ ] Add `getDemandAnalyticsController` handler
- [ ] Route should be publicly accessible (no auth)

**Reference:** Lines 616-627
**Links to:** `[requirements.md: TBD - GET /demand Endpoint]`
**Files:** `src/api/v1/routes/analytics/analytics.routes.js`
**Estimated Complexity:** Low

---

### Task 3.7: Define Property-Specific Views Route
- [ ] Create GET route `/demand/:id`
- [ ] Add validation middleware array:
  - [ ] `param('id').notEmpty().withMessage('Property ID is required').trim()`
  - [ ] `rangeValidation`
- [ ] Add `validateRequest` middleware
- [ ] Add `getPropertyViewsController` handler
- [ ] Route should be publicly accessible (no auth)

**Reference:** Lines 630-638
**Links to:** `[requirements.md: TBD - GET /demand/:id Endpoint]`
**Files:** `src/api/v1/routes/analytics/analytics.routes.js`
**Estimated Complexity:** Low

---

### Task 3.8: Define Admin Refresh Route
- [ ] Create POST route `/refresh`
- [ ] Add `verifySupabaseToken` middleware (authentication required)
- [ ] Add `refreshAnalyticsController` handler
- [ ] Route should require authentication (admin only)
- [ ] **Note:** Consider adding additional admin role check middleware

**Reference:** Lines 641-645
**Links to:** `[requirements.md: TBD - POST /refresh Endpoint]`
**Files:** `src/api/v1/routes/analytics/analytics.routes.js`
**Estimated Complexity:** Medium

---

### Task 3.9: Export Router
- [ ] Export the configured router as default export

**Reference:** Line 647
**Files:** `src/api/v1/routes/analytics/analytics.routes.js`
**Estimated Complexity:** Low

---

## Phase 4: Integration & Registration

**Goal:** Register analytics routes with the main application router.

**Reference:** `analytics-implementation-plan.md` Step 5 (Lines 650-662)
**Links to:** `[plan.md: TBD]` | `[requirements.md: TBD - Route Registration]`

### Task 4.1: Update Main Routes Index
- [ ] Open `src/api/v1/routes/index.js`
- [ ] Import analytics routes: `import analyticsRoutes from "./analytics/analytics.routes.js"`
- [ ] Register analytics routes: `router.use("/analytics", analyticsRoutes)`
- [ ] Verify the route prefix creates endpoints under `/api/v1/analytics`

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
- [ ] Run `npm install node-cron`
- [ ] Verify installation in `package.json`

**Reference:** Lines 817-819
**Files:** `package.json`
**Estimated Complexity:** Low

---

### Task 5.2: Create Jobs Directory
- [ ] Create directory `src/jobs/` (if it doesn't exist)

**Files:** Directory structure
**Estimated Complexity:** Low

---

### Task 5.3: Implement Analytics Refresh Job
- [ ] Create `src/jobs/refreshAnalytics.js`
- [ ] Import `cron` from `node-cron`
- [ ] Import Prisma client from `#database/client.js`
- [ ] Implement `scheduleAnalyticsRefresh()` function
  - [ ] Schedule cron job to run every 30 minutes: `*/30 * * * *`
  - [ ] Execute `refresh_analytics_views()` PostgreSQL function
  - [ ] Add console logging for start and success
  - [ ] Add error handling with console logging
- [ ] Export `scheduleAnalyticsRefresh` function

**Reference:** Lines 672-688
**Files:** `src/jobs/refreshAnalytics.js`
**Estimated Complexity:** Medium

---

### Task 5.4: Register Job in Application
- [ ] Open `src/app.js`
- [ ] Import refresh job: `import { scheduleAnalyticsRefresh } from './jobs/refreshAnalytics.js'`
- [ ] Call `scheduleAnalyticsRefresh()` after `app.listen()`
- [ ] **Consider:** Only enable in production: `if (process.env.NODE_ENV === 'production')`

**Reference:** Lines 690-701
**Files:** `src/app.js`
**Estimated Complexity:** Low

---

### Task 5.5: Document Alternative Refresh Strategies
- [ ] Add comment in code about pg_cron option (for Supabase/PostgreSQL extension)
- [ ] Add comment about system cron job option
- [ ] Add comment about cloud scheduler option (for cloud deployments)

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
