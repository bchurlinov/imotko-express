# Technical Tasks: Agency Website Configuration API

## Phase 1: Core Infrastructure

### Task 1.1: Create URL Normalization Utility
**Plan Reference:** [Plan 1.1] URL Normalization Utility
**Requirements Reference:** [Req 2] URL Normalization for Matching

- [x] 1.1.1 Create file `src/utils/url/normalizeUrl.js`
- [x] 1.1.2 Implement `normalizeUrl(url)` function that:
  - Parses URL using `new URL()` constructor
  - Extracts hostname
  - Removes `www.` prefix if present
  - Converts to lowercase
  - Returns normalized domain string
- [x] 1.1.3 Implement `extractDomain(url)` helper function
- [x] 1.1.4 Add try-catch for malformed URL handling, return `null` on parse failure
- [x] 1.1.5 Add JSDoc type annotations for functions
- [x] 1.1.6 Export functions from utility module

---

### Task 1.2: Configure Environment Variables
**Plan Reference:** [Plan 1.2] Environment Configuration
**Requirements Reference:** [Req 3] Static Allowed Referrers List

- [x] 1.2.1 Add `ALLOWED_REFERRERS` to `.env.example` with sample value
- [x] 1.2.2 Add `ALLOWED_REFERRERS` to local `.env` file for development
- [x] 1.2.3 Create file `src/config/website.config.js`
- [x] 1.2.4 Implement `getAllowedReferrers()` function that:
  - Reads `ALLOWED_REFERRERS` environment variable
  - Splits by comma
  - Trims whitespace from each entry
  - Returns array of allowed referrer strings
  - Returns empty array if not configured
- [x] 1.2.5 Export configuration accessor

---

### Task 1.3: Implement Service Layer
**Plan Reference:** [Plan 1.3] Service Layer Implementation
**Requirements Reference:** [Req 1] Referer-Based Agency Lookup, [Req 10] Database Query Performance

- [x] 1.3.1 Open existing file `src/api/v1/services/website/website.service.js`
- [x] 1.3.2 Import Prisma client from `@/database/client.js`
- [x] 1.3.3 Import URL normalization utility
- [x] 1.3.4 Implement `getAgencyByReferer(referer)` function:
  - Normalize the referer URL
  - Query database for agency where normalized `social.website` matches
  - Exclude agencies with NULL/empty website values
  - Use LIMIT 1 for single result
  - Return agency object or null
- [x] 1.3.5 Implement database query using Prisma raw query or findFirst:
  ```javascript
  // Query agencies where website domain matches referer domain
  ```
- [x] 1.3.6 Add JSDoc type annotations

---

### Task 1.4: Implement Controller
**Plan Reference:** [Plan 1.4] Controller Implementation
**Requirements Reference:** [Req 1] Referer-Based Agency Lookup, [Req 7] Error Response Consistency

- [x] 1.4.1 Open existing file `src/api/v1/controllers/website/website.controller.js`
- [x] 1.4.2 Import service functions
- [x] 1.4.3 Implement `getWebsiteConfiguration` controller function:
  - Extract `referer` header from request (`req.get('referer')`)
  - Extract `origin` header from request (`req.get('origin')`)
  - Extract `user-agent` header from request
  - Call service layer for authorization and data retrieval
  - Return formatted response
- [x] 1.4.4 Implement error handling with try-catch
- [x] 1.4.5 Format success response: `{ data, code: 200, message: "Agency configuration loaded successfully" }`
- [x] 1.4.6 Format error responses per [Req 7]
- [x] 1.4.7 Export controller function

---

### Task 1.5: Define Route
**Plan Reference:** [Plan 1.5] Route Definition
**Requirements Reference:** [Req 1] Referer-Based Agency Lookup

- [x] 1.5.1 Open existing file `src/api/v1/routes/website/website.routes.js`
- [x] 1.5.2 Import controller
- [x] 1.5.3 Define GET route for `/configuration`
- [x] 1.5.4 Export router
- [x] 1.5.5 Register website routes in `src/api/v1/routes/index.js`:
  - Import website routes
  - Mount at `/api/v1/website`

---

## Phase 2: Authorization Logic

### Task 2.1: Implement Referer Validation
**Plan Reference:** [Plan 2.1] Referer Validation Logic
**Requirements Reference:** [Req 1], [Req 3]

- [x] 2.1.1 In service layer, implement `isAllowedReferrer(referer)` function:
  - Get allowed referrers from config
  - Normalize both referer and allowed referrer URLs
  - Return true if any match
- [x] 2.1.2 Implement `getAgencyWebsiteConfiguration(referer, origin, userAgent)` main service function:
  - Check if referer exists, return 403 error info if not
  - Check allowed referrers list
  - Query database for matching agency
  - Return authorization result with agency data or error info
- [x] 2.1.3 Return object with structure: `{ success, data, error: { code, message } }`

---

### Task 2.2: Implement Origin Cross-Validation
**Plan Reference:** [Plan 2.2] Origin Header Cross-Validation
**Requirements Reference:** [Req 5] Security: Origin Header Validation

- [x] 2.2.1 In service layer, implement `validateOriginRefererMatch(referer, origin)` function:
  - If both headers present, normalize and compare domains
  - Return false if domains don't match
  - Return true if only one header present
  - Return true if both match
- [x] 2.2.2 Integrate validation into main service function
- [x] 2.2.3 Return 403 on mismatch with message "forbiddenReferer"

---

### Task 2.3: Implement Development Bypass
**Plan Reference:** [Plan 2.3] Development Bypass
**Requirements Reference:** [Req 4] Development Environment Bypass

- [x] 2.3.1 Implement `isDevelopmentBypass(userAgent)` function:
  - Check if `NODE_ENV === 'development'`
  - Check if user-agent contains "postman" (case-insensitive)
  - Return true only if both conditions met
- [x] 2.3.2 In main service function, allow bypass when:
  - Development bypass is active
  - Referer header is still provided
- [x] 2.3.3 Continue to agency lookup even when bypass is active

---

## Phase 3: Response Handling

### Task 3.1: Implement Response Data Filtering
**Plan Reference:** [Plan 3.1] Response Data Filtering
**Requirements Reference:** [Req 6] Response Data Filtering

- [x] 3.1.1 Define `ALLOWED_AGENCY_FIELDS` constant array:
  - id, name, logo, social, description, address
- [x] 3.1.2 Implement `filterAgencyData(agency)` function:
  - Pick only allowed fields from agency object
  - Return filtered object
- [x] 3.1.3 Apply filter before returning agency data in service layer
- [x] 3.1.4 Alternatively, use Prisma select to fetch only needed fields

---

### Task 3.2: Standardize Error Responses
**Plan Reference:** [Plan 3.2] Error Response Standardization
**Requirements Reference:** [Req 7] Error Response Consistency

- [x] 3.2.1 Define error response constants/helper:
  ```javascript
  const ErrorResponses = {
    FORBIDDEN_REFERER: { code: 403, message: 'forbiddenReferer' },
    AGENCY_NOT_FOUND: { code: 404, message: 'agencyNotFound' },
    INTERNAL_ERROR: { code: 500, message: 'somethingWentWrong' }
  };
  ```
- [x] 3.2.2 Create `formatErrorResponse(errorType)` helper if needed
- [x] 3.2.3 Update controller to use standardized error responses

---

## Phase 4: Security & Performance

### Task 4.1: Implement Domain-Based Rate Limiting
**Plan Reference:** [Plan 4.1] Rate Limiting by Domain
**Requirements Reference:** [Req 8] Rate Limiting

- [x] 4.1.1 Create file `src/api/v1/middlewares/domainRateLimit.js`
- [x] 4.1.2 Import `express-rate-limit` package (already in project)
- [x] 4.1.3 Implement custom key generator using normalized referer domain
- [x] 4.1.4 Configure rate limiter:
  - windowMs: 15 * 60 * 1000 (15 minutes)
  - max: 100 requests
  - standardHeaders: true (includes Retry-After)
- [x] 4.1.5 Implement custom handler for 429 response:
  - Return `{ data: undefined, code: 429, message: 'tooManyRequests' }`
- [x] 4.1.6 Export rate limiter middleware
- [x] 4.1.7 Apply middleware to website configuration route

---

### Task 4.2: Implement Security Audit Logging
**Plan Reference:** [Plan 4.2] Security Audit Logging
**Requirements Reference:** [Req 9] Request Logging for Security Auditing

- [x] 4.2.1 Create `logSecurityEvent(eventType, details)` function in service or utility
- [x] 4.2.2 Log on access denied events:
  - Timestamp
  - IP address (from req.ip)
  - Referer header value
  - Origin header value
  - User-Agent header value
  - Denial reason
- [x] 4.2.3 Log on referer/origin mismatch
- [x] 4.2.4 Use console.warn or dedicated logger (consider structured JSON format)
- [x] 4.2.5 Ensure no sensitive data (cookies, auth tokens) is logged

---

### Task 4.3: Optimize Database Query
**Plan Reference:** [Plan 4.3] Database Query Optimization
**Requirements Reference:** [Req 10] Database Query Performance

- [x] 4.3.1 Review current query implementation
- [x] 4.3.2 Document recommended index on `social->>'website'`:
  ```sql
  CREATE INDEX idx_agency_website ON "Agency" ((social->>'website'));
  ```
  Note: Index creation via migration skipped per user request. Documentation added to code.
- [x] 4.3.3 Add ORDER BY id for deterministic results
- [x] 4.3.4 Ensure query excludes NULL and empty string website values (enhanced with trim())
- [x] 4.3.5 Add logging for malformed agency website URLs
- [x] 4.3.6 Add warning logging for multiple agency matches

---

## Phase 5: Edge Cases & Polish

### Task 5.1: Handle Multiple Agency Matches
**Plan Reference:** [Plan 5.1] Multiple Match Handling
**Requirements Reference:** [Req 11] Edge Case: Multiple Agency Matches

- [x] 5.1.1 Add ORDER BY id to database query for deterministic results
- [x] 5.1.2 Implement match counting to detect multiple matches
- [x] 5.1.3 Log warning when multiple matches exist:
  ```javascript
  console.warn(`Multiple agencies match domain: ${domain}`);
  ```

---

### Task 5.2: Handle Malformed URLs
**Plan Reference:** [Plan 5.2] Malformed URL Handling
**Requirements Reference:** [Req 12] Edge Case: Malformed URLs

- [x] 5.2.1 In normalizeUrl utility, return null for unparseable URLs
- [x] 5.2.2 In service layer, check for null from normalization
- [x] 5.2.3 Return 403 error when referer URL is malformed
- [x] 5.2.4 Log malformed URL errors for debugging using security logger
- [x] 5.2.5 When iterating agencies, skip those with malformed stored URLs
- [x] 5.2.6 Log warning for agencies with malformed website URLs

---

## Phase 6: Integration & Testing

### Task 6.1: Integration
**Plan Reference:** All phases
**Requirements Reference:** All requirements

- [x] 6.1.1 Verify route is accessible at `GET /api/v1/website/configuration`
- [x] 6.1.2 Test with Postman in development mode
- [x] 6.1.3 Test with missing referer header (expect 403)
- [x] 6.1.4 Test with valid referer matching an agency (expect 200)
- [x] 6.1.5 Test with valid referer not matching any agency (expect 404)
- [x] 6.1.6 Test with mismatched referer and origin headers (expect 403)
- [x] 6.1.7 Verify response format consistency

---

### Task 6.2: Documentation
**Plan Reference:** All phases
**Requirements Reference:** All requirements

- [x] 6.2.1 Update .env.example with ALLOWED_REFERRERS documentation
- [x] 6.2.2 Add inline JSDoc comments to all new functions
- [x] 6.2.3 Update docs/agency_website_configuration.md with final implementation notes

---

## Summary

| Phase | Task Count | Status |
|-------|-----------|--------|
| Phase 1: Core Infrastructure | 6 tasks (26 subtasks) | [x] |
| Phase 2: Authorization Logic | 3 tasks (8 subtasks) | [x] |
| Phase 3: Response Handling | 2 tasks (7 subtasks) | [x] |
| Phase 4: Security & Performance | 3 tasks (18 subtasks) | [x] |
| Phase 5: Edge Cases & Polish | 2 tasks (11 subtasks) | [x] |
| Phase 6: Integration & Testing | 2 tasks (10 subtasks) | [x] |
| **Total** | **18 tasks (80 subtasks)** | **✅ 100% Complete** |

---

## Implementation Complete

**Status:** ✅ Production Ready
**Date Completed:** December 22, 2025
**Endpoint:** `GET /api/v1/website/configuration`

All phases have been successfully implemented, tested, and documented. The Agency Website Configuration API is now production-ready with:
- ✅ Referer-based authorization with Origin cross-validation
- ✅ Domain-based rate limiting (100 req/15min)
- ✅ Security audit logging
- ✅ Comprehensive JSDoc documentation
- ✅ Edge case handling
- ✅ All integration tests passing

See `docs/agency_website_configuration.md` for complete implementation details.
