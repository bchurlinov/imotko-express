# Implementation Plan: Agency Website Configuration API

## Overview

This plan outlines the implementation strategy for the Agency Website Configuration API endpoint, organized by priority and linked to requirements.

---

## Phase 1: Core Infrastructure (High Priority)

### Plan Item 1.1: URL Normalization Utility
**Priority:** High
**Related Requirements:** [Req 2] URL Normalization for Matching

Create a utility function that normalizes URLs for consistent comparison:
- Extract hostname from URL
- Remove `www.` prefix
- Handle protocol differences (http/https)
- Remove trailing slashes
- Handle malformed URLs gracefully

**Location:** `src/utils/url/normalizeUrl.js`

---

### Plan Item 1.2: Environment Configuration
**Priority:** High
**Related Requirements:** [Req 3] Static Allowed Referrers List

Configure environment variables and create configuration module:
- Add `ALLOWED_REFERRERS` to `.env.example`
- Create config accessor for parsing comma-separated referrers
- Provide sensible defaults for development

**Location:** `src/config/website.config.js`

---

### Plan Item 1.3: Service Layer Implementation
**Priority:** High
**Related Requirements:** [Req 1] Referer-Based Agency Lookup, [Req 10] Database Query Performance

Implement the core business logic in the service layer:
- `getAgencyByReferer(referer)` - Find agency by normalized domain
- Use domain extraction for efficient database queries
- Filter out NULL/empty website values
- Return only necessary fields

**Location:** `src/api/v1/services/website/website.service.js`

---

### Plan Item 1.4: Controller Implementation
**Priority:** High
**Related Requirements:** [Req 1] Referer-Based Agency Lookup, [Req 7] Error Response Consistency

Implement the request handler:
- Extract Referer and Origin headers
- Coordinate authorization checks
- Call service layer
- Format responses consistently

**Location:** `src/api/v1/controllers/website/website.controller.js`

---

### Plan Item 1.5: Route Definition
**Priority:** High
**Related Requirements:** [Req 1] Referer-Based Agency Lookup

Define the API route:
- Route: `GET /api/v1/website/configuration`
- Apply appropriate middlewares
- No authentication middleware (referer-based auth)

**Location:** `src/api/v1/routes/website/website.routes.js`

---

## Phase 2: Authorization Logic (High Priority)

### Plan Item 2.1: Referer Validation Logic
**Priority:** High
**Related Requirements:** [Req 1] Referer-Based Agency Lookup, [Req 3] Static Allowed Referrers List

Implement the authorization decision flow:
1. Check if referer exists
2. Check against ALLOWED_REFERRERS (using normalized comparison)
3. Check against database agencies
4. Return appropriate response based on authorization result

**Location:** `src/api/v1/services/website/website.service.js`

---

### Plan Item 2.2: Origin Header Cross-Validation
**Priority:** High
**Related Requirements:** [Req 5] Security: Origin Header Validation

Add Origin header validation:
- Compare Origin and Referer domains when both present
- Reject requests with mismatched headers
- Allow requests with only one header present

**Location:** `src/api/v1/services/website/website.service.js`

---

### Plan Item 2.3: Development Bypass
**Priority:** Medium
**Related Requirements:** [Req 4] Development Environment Bypass

Implement development-only bypass for testing:
- Check NODE_ENV for development mode
- Detect Postman via User-Agent header
- Require Referer header even in bypass mode
- Disable in production

**Location:** `src/api/v1/services/website/website.service.js`

---

## Phase 3: Response Handling (Medium Priority)

### Plan Item 3.1: Response Data Filtering
**Priority:** Medium
**Related Requirements:** [Req 6] Response Data Filtering

Create a data transformation layer:
- Define allowed fields for agency response
- Strip sensitive/internal fields
- Ensure consistent response structure

**Location:** `src/api/v1/services/website/website.service.js`

---

### Plan Item 3.2: Error Response Standardization
**Priority:** Medium
**Related Requirements:** [Req 7] Error Response Consistency

Implement standardized error responses:
- Create error response helper function
- Define error message keys
- Ensure all error paths use consistent format

**Location:** `src/utils/response/errorResponse.js` (or inline in controller)

---

## Phase 4: Security & Performance (Medium Priority)

### Plan Item 4.1: Rate Limiting by Domain
**Priority:** Medium
**Related Requirements:** [Req 8] Rate Limiting

Implement domain-based rate limiting:
- Create custom rate limiter keyed by normalized referer domain
- Configure 100 requests per 15 minutes
- Add Retry-After header on limit exceeded
- Consider using existing rate limit middleware with custom key generator

**Location:** `src/api/v1/middlewares/domainRateLimit.js`

---

### Plan Item 4.2: Security Audit Logging
**Priority:** Medium
**Related Requirements:** [Req 9] Request Logging for Security Auditing

Implement security event logging:
- Log denied requests with relevant details
- Log referer/origin mismatches
- Avoid logging sensitive data
- Consider structured logging format for analysis

**Location:** `src/api/v1/services/website/website.service.js` or dedicated logger

---

### Plan Item 4.3: Database Query Optimization
**Priority:** Medium
**Related Requirements:** [Req 10] Database Query Performance

Optimize the database query:
- Use domain extraction in query
- Add database index on `social->>'website'` (migration)
- Ensure NULL/empty exclusion
- Use LIMIT 1 for single result

**Location:** `src/api/v1/services/website/website.service.js`, `prisma/migrations/`

---

## Phase 5: Edge Cases & Polish (Low Priority)

### Plan Item 5.1: Multiple Match Handling
**Priority:** Low
**Related Requirements:** [Req 11] Edge Case: Multiple Agency Matches

Handle multiple agency matches:
- Order by agency ID for deterministic results
- Log warning when multiple matches possible
- Return first match consistently

**Location:** `src/api/v1/services/website/website.service.js`

---

### Plan Item 5.2: Malformed URL Handling
**Priority:** Low
**Related Requirements:** [Req 12] Edge Case: Malformed URLs

Implement robust URL parsing:
- Wrap URL parsing in try-catch
- Return 403 for malformed referer URLs
- Log parsing errors for debugging
- Skip agencies with malformed stored URLs

**Location:** `src/utils/url/normalizeUrl.js`, `src/api/v1/services/website/website.service.js`

---

## Implementation Order Summary

| Order | Plan Item | Priority | Key Files |
|-------|-----------|----------|-----------|
| 1 | 1.1 URL Normalization | High | utils/url/normalizeUrl.js |
| 2 | 1.2 Environment Config | High | config/website.config.js |
| 3 | 1.3 Service Layer | High | services/website/website.service.js |
| 4 | 1.4 Controller | High | controllers/website/website.controller.js |
| 5 | 1.5 Route Definition | High | routes/website/website.routes.js |
| 6 | 2.1 Referer Validation | High | services/website/website.service.js |
| 7 | 2.2 Origin Validation | High | services/website/website.service.js |
| 8 | 2.3 Dev Bypass | Medium | services/website/website.service.js |
| 9 | 3.1 Response Filtering | Medium | services/website/website.service.js |
| 10 | 3.2 Error Standardization | Medium | controller or utils |
| 11 | 4.1 Rate Limiting | Medium | middlewares/domainRateLimit.js |
| 12 | 4.2 Security Logging | Medium | services or logger |
| 13 | 4.3 DB Optimization | Medium | service, migrations |
| 14 | 5.1 Multiple Match | Low | services/website/website.service.js |
| 15 | 5.2 Malformed URLs | Low | utils, services |

---

## Dependencies

- **External packages needed:** None (using existing express-rate-limit, can extend)
- **Database changes:** Optional index on `social->>'website'` for performance
- **Environment variables:** `ALLOWED_REFERRERS` (new)

## Testing Strategy

1. Unit tests for URL normalization utility
2. Unit tests for service layer authorization logic
3. Integration tests for full request/response cycle
4. Manual testing with Postman in development mode
5. Test with actual browser requests from test HTML page
