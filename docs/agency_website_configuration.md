import { NextResponse } from "next/server";
import prisma from "@/lib/prismadb";

const ALLOWED_REFERRERS = ["http://delta.mk/"];

export async function GET(req) {
try {
const referer = req.headers.get("referer");
const userAgent = req.headers.get("user-agent") || "";

        const isDevelopment = process.env.NODE_ENV === "development";
        const isPostman = userAgent.toLowerCase().includes("postman");
        const isAllowedReferer = referer && ALLOWED_REFERRERS.some((allowed) => referer.startsWith(allowed));
        const isLocalhostPostman = isPostman && isDevelopment && referer;

        let matchedAgency = null;

        // Query database for matching agency if:
        // - Has referer AND
        // - Not already allowed through localhost+Postman AND
        // - Not already in the allowed referrers list
        if (referer && !isLocalhostPostman && !isAllowedReferer) {
            const result = await prisma.$queryRaw`
                SELECT id 
                FROM "Agency" 
                WHERE social->>'website' IS NOT NULL 
                AND (
                    ${referer} LIKE social->>'website' || '%' OR
                    social->>'website' LIKE ${referer} || '%'
                )
                LIMIT 1
            `;

            if (result.length > 0) matchedAgency = result[0];
        }

        // For localhost+Postman, also try to find matching agency
        if (isLocalhostPostman && !matchedAgency) {
            const result = await prisma.$queryRaw`
                SELECT * 
                FROM "Agency" 
                WHERE social->>'website' IS NOT NULL 
                AND (
                    ${referer} LIKE social->>'website' || '%' OR
                    social->>'website' LIKE ${referer} || '%'
                )
                LIMIT 1
            `;

            if (result.length > 0) matchedAgency = result[0];
        }

        // Deny if NONE of the authorization methods pass
        if (!isLocalhostPostman && !isAllowedReferer && !matchedAgency) {
            return NextResponse.json(
                {
                    data: undefined,
                    code: 403,
                    message: "forbiddenReferer",
                },
                { status: 403, statusText: "Forbidden" }
            );
        }

        if (!matchedAgency) {
            return NextResponse.json(
                {
                    data: undefined,
                    code: 404,
                    message: "Agency not found",
                },
                { status: 404, statusText: "Not Found" }
            );
        }

        return NextResponse.json(
            {
                data: matchedAgency,
                code: 200,
                message: "Properties loaded successfully",
            },
            { status: 200, statusText: "OK" }
        );
    } catch (err) {
        console.error(err);
        return NextResponse.json(
            { data: undefined, code: 500, message: "somethingWentWrong" },
            { status: 500, statusText: "Not OK" }
        );
    }
}

Analysis of Current Next.js Implementation

Looking at docs/agency_website_configuration.md, the Next.js route handles:

1. Referer-based authorization with multiple fallback methods:
   - Static allowed referrers list (ALLOWED_REFERRERS)
   - Development + Postman combination
   - Dynamic database lookup for agency websites
2. Database query pattern:
   - Uses bidirectional LIKE matching on social->>'website'
   - Queries: referer LIKE website% OR website LIKE referer%
3. Response flow:
   - 403 Forbidden if no authorization passes
   - 404 if authorized but no agency found
   - 200 with agency data if found

Considerations for Express.js Migration

1. Authorization Logic Flow

There's a potential logic issue in the Next.js code around lines 65-74. It checks !matchedAgency and returns 404, but this happens even when isLocalhostPostman or isAllowedReferer is true (where we don't query the database at all). Should we:

- Option A: Return agency data only when found via database lookup (current Next.js behavior)
- Option B: Allow the endpoint to work for ALLOWED_REFERRERS without requiring an agency match (just authorize the request)

What's the intended behavior? Should the static allowed referrers also need to match an agency, or are they different types of clients?

2. Database Query Pattern

The bidirectional LIKE pattern is interesting:
referer LIKE social->>'website' || '%' OR
social->>'website' LIKE referer || '%'

This handles cases like:
- Agency website: https://delta.mk/ → Referer: https://delta.mk/properties/123
- But also the reverse matching

Potential issues:
- Security: LIKE pattern matching could have false positives (e.g., delta.mk matching fakedelta.mk.evil.com)
- URL normalization: Should we normalize URLs (http/https, trailing slashes, www prefix)?
- Performance: JSON field queries with LIKE aren't indexed - could be slow at scale

3. Service Layer Design

For getAgencyWebsiteConfiguration, I'm thinking:

// Potential signature:
getAgencyWebsiteConfiguration(referer, {
isDevelopment,
userAgent,
allowedReferrers
})

Questions:
- Should the service handle ALL the authorization logic, or just the database lookup?
- Where should ALLOWED_REFERRERS live - config file, environment variable, database?
- Should we separate concerns: one service for "find agency by referer" and another for "check authorization"?

4. Express-Specific Considerations

- Referer header: Access via req.headers.referer or req.get('referer')
- User-Agent: Access via req.get('user-agent')
- Environment: Already using process.env.NODE_ENV
- Response format: Should match your existing API patterns (I see you return agency directly in line 14 of controller)

5. Security & Edge Cases

- Missing referer header: Some browsers/clients don't send it - how to handle?
- Spoofed referers: Referer can be manipulated - is this acceptable for your use case?
- Multiple matches: LIMIT 1 returns arbitrary match if multiple agencies have similar domains
- NULL/empty website values: The query checks IS NOT NULL, but should we also check for empty strings?

Proposed Architecture

Controller layer (website.controller.js):
- Extract referer, user-agent from request
- Pass to service
- Handle response formatting

Service layer (website.service.js):
- getAgencyByReferer(referer, options) - pure database lookup
- getAgencyWebsiteConfiguration(req) - full authorization flow (if you want to keep it together)

Configuration:
- Move ALLOWED_REFERRERS to environment/config

Key Questions Before Implementation

1. What should happen when ALLOWED_REFERRERS match? Should it still require finding an agency, or just authorize the request?
2. Do you want to keep the Postman + development bypass? Seems like a dev convenience feature.
3. Should we improve the URL matching logic to handle protocol differences, trailing slashes, www prefix variations?
4. What data should be returned? The Next.js version returns the full matchedAgency object. Should we filter sensitive fields?
5. Should ALLOWED_REFERRERS be configurable or hardcoded like in the Next.js version?

Let me know your thoughts on these points, and we can refine the approach before implementing!

----

⏺ My Recommendations

Is Referer-Based Auth Good Enough?

Yes, for your use case it's appropriate because:

1. Browser Context Protection: When agencies embed your widget/script on their site, the browser automatically sends the referer header. It's difficult to spoof in legitimate browser contexts due to CORS and SameSite policies.
2. Zero Configuration for Agencies: Agencies just embed your script - no API key management needed.
3. Combined with Origin Header: You can check both Referer and Origin headers for extra validation.

However, be aware of limitations:
- Some privacy-focused browsers/extensions strip referer headers
- Not suitable if you later need server-to-server calls
- Can be bypassed in non-browser contexts (curl, Postman, etc.)

Alternative/Enhanced Approaches to Consider:

1. Hybrid Approach (Recommended):
   - Use referer/origin for widget embeds (browser-based)
   - Optionally add API keys for server-to-server calls if needed later
   - Use rate limiting per agency domain
2. Signed Widget URLs: Generate time-limited signed URLs for agencies (adds complexity but more secure)
3. CORS + Referer: Enable CORS to validate Origin header alongside Referer

My Proposed Architecture

┌─────────────────────────────────────────────┐
│ Request from Agency Website                 │
│ Headers: Referer, Origin, User-Agent        │
└─────────────────┬───────────────────────────┘
│
▼
┌─────────────────────────────────────────────┐
│ Controller: Extract headers, validate       │
└─────────────────┬───────────────────────────┘
│
▼
┌─────────────────────────────────────────────┐
│ Service: Authorization Logic                │
│ 1. Check ENV allowed referrers              │
│ 2. Normalize & match against DB            │
│ 3. Cache results (optional)                 │
└─────────────────┬───────────────────────────┘
│
▼
┌─────────────────────────────────────────────┐
│ Return: Agency config + 200                 │
│     OR: 403 Forbidden / 404 Not Found       │
└─────────────────────────────────────────────┘

Specific Recommendations:

1. Environment Variables for Allowed Referrers
# .env
ALLOWED_REFERRERS=http://localhost:3000,http://localhost:5173,https://delta.mk

2. URL Normalization - Critical for proper matching:
   // Normalize URLs to handle:
   // - http vs https
   // - trailing slashes
   // - www prefix
   // - query params

3. Local Development Mocking Strategy:
- Add localhost:* to allowed referrers in development
- Use browser extension to set custom referer headers
- Or use Postman/Thunder Client with custom headers
- Create a simple HTML test page that makes requests

4. Database Query Improvements:
- Use domain extraction instead of full URL LIKE matching
- Add indexes on social->>'website' for performance
- Validate URL format before storing

5. Security Enhancements:
- Check both Referer AND Origin headers
- Implement rate limiting per domain
- Log unauthorized access attempts
- Consider adding CORS whitelist that matches allowed referrers

---

## Final Implementation Notes

### Implementation Summary

The Agency Website Configuration API has been fully implemented for the Express.js backend following all requirements and recommendations. The implementation is production-ready with comprehensive security, performance optimization, and error handling.

**Implementation Date:** December 2025
**Status:** ✅ Complete
**Endpoint:** `GET /api/v1/website/configuration`

### Architecture Overview

```
Request Flow:
1. Client Request → Rate Limiter (domain-based, 100 req/15min)
2. Rate Limiter → Controller (header extraction)
3. Controller → Service Layer (authorization & business logic)
4. Service Layer → Database (agency lookup) OR Config (allowed referrers)
5. Response → Standardized JSON format
```

### Implemented Components

#### 1. URL Normalization Utility
**Location:** `src/utils/url/normalizeUrl.js`

- `normalizeUrl(url)` - Normalizes URLs for consistent comparison
- `extractDomain(url)` - Extracts hostname from URL
- Handles: www prefix removal, case normalization, malformed URLs
- Returns `null` for invalid URLs (safe failure)

#### 2. Configuration Module
**Location:** `src/config/website.config.js`

- `getAllowedReferrers()` - Reads `ALLOWED_REFERRERS` env variable
- Parses comma-separated list of allowed domains
- Returns empty array if not configured
- Example: `ALLOWED_REFERRERS=localhost:3000,example.com`

#### 3. Service Layer
**Location:** `src/api/v1/services/website/website.service.js`

**Main Functions:**
- `getAgencyWebsiteConfiguration(referer, origin, userAgent, ip)` - Main authorization orchestrator
- `getAgencyByReferer(referer)` - Database lookup for matching agencies
- `isAllowedReferrer(referer)` - Static allowed referrers check
- `validateOriginRefererMatch(referer, origin)` - Cross-header validation
- `isDevelopmentBypass(userAgent)` - Development mode convenience
- `filterAgencyData(agency)` - Response data sanitization

**Authorization Flow:**
1. Check referer header exists → 403 if missing
2. Validate referer is well-formed URL → 403 if malformed
3. Validate Origin/Referer match (if both present) → 403 if mismatch
4. Check development bypass (NODE_ENV=development + Postman)
5. Check against ALLOWED_REFERRERS list → 200 if match
6. Query database for matching agency → 200 if found, 404 if not
7. Return filtered agency data (id, name, logo, social, description, address)

**Database Query Optimization:**
- Uses Prisma `findMany` with `select` for field filtering
- Orders by `id` for deterministic results (handles multiple matches)
- Filters NULL/empty website values
- Normalizes and compares domains (not full URLs)
- Logs warnings for multiple matches and malformed agency URLs
- **Performance Note:** For optimal performance at scale, add index:
  ```sql
  CREATE INDEX idx_agency_website ON "Agency" ((social->>'website'));
  ```

#### 4. Controller Layer
**Location:** `src/api/v1/controllers/website/website.controller.js`

- `agencyWebsiteConfigurationController` - Request handler
- Extracts headers: referer, origin, user-agent, ip
- Delegates to service layer
- Returns standardized responses:
  - **200 OK:** `{ data, code: 200, message: "Agency configuration loaded successfully" }`
  - **403 Forbidden:** `{ code: 403, message: "forbiddenReferer" }`
  - **404 Not Found:** `{ code: 404, message: "agencyNotFound" }`
  - **429 Too Many Requests:** `{ code: 429, message: "tooManyRequests" }`
  - **500 Internal Error:** `{ code: 500, message: "somethingWentWrong" }`

#### 5. Route Definition
**Location:** `src/api/v1/routes/website/website.routes.js`

- Route: `GET /api/v1/website/configuration`
- Middleware: `domainRateLimit` (applied before controller)
- No authentication middleware (uses referer-based auth)
- Registered in main routes at `/api/v1/website`

#### 6. Rate Limiting Middleware
**Location:** `src/api/v1/middlewares/domainRateLimit.js`

- Domain-based rate limiting (not IP-based)
- Limit: 100 requests per 15 minutes per domain
- Key generation: Uses normalized referer domain
- Fallback to IP if referer missing/malformed
- Custom 429 handler with standardized response format
- Includes `Retry-After` header
- Can be disabled via `DISABLE_RATE_LIMIT=true` env variable

#### 7. Security Logging
**Location:** `src/utils/logger/securityLogger.js`

**Event Types:**
- `ACCESS_DENIED` - Request denied (with reason)
- `ORIGIN_MISMATCH` - Origin/Referer headers don't match
- `MALFORMED_URL` - Invalid URL format
- `MISSING_REFERER` - Required referer header absent
- `AGENCY_NOT_FOUND` - No matching agency in database
- `DEV_BYPASS_ACTIVE` - Development bypass used

**Logging Functions:**
- `logAccessDenied(details)` - Logs denied requests
- `logOriginMismatch(details)` - Logs header mismatches
- `logMalformedUrl(details)` - Logs URL parsing errors
- `logMissingReferer(details)` - Logs missing headers
- `logAgencyNotFound(details)` - Logs failed lookups
- `logDevBypass(details)` - Logs development bypasses

**Logged Data:** timestamp, IP, referer, origin, user-agent, reason
**Privacy:** Does NOT log sensitive data (cookies, tokens, passwords)

### Environment Variables

Required addition to `.env`:
```bash
# Website Configuration
# Comma-separated list of allowed referrer domains for website configuration API
# Example: localhost:3000,example.com,agency-website.com
ALLOWED_REFERRERS=localhost:3000
```

### Security Features

1. **Referer-Based Authorization**
   - Primary authorization mechanism for browser-based requests
   - Automatic header sent by browsers (hard to spoof in browser context)
   - Suitable for embedded widgets/scripts

2. **Origin Cross-Validation**
   - When both Origin and Referer present, domains must match
   - Prevents header spoofing attacks
   - Rejects requests with mismatched headers

3. **URL Normalization**
   - Prevents bypass via URL variations
   - Handles: http/https, www prefix, case sensitivity
   - Protects against false positives (e.g., evil.com vs evilexample.com)

4. **Rate Limiting**
   - Domain-based (not IP-based) to prevent per-domain abuse
   - 100 requests per 15 minutes per domain
   - Prevents DoS attacks and excessive usage

5. **Security Audit Logging**
   - All denied requests logged with details
   - Structured JSON format for analysis
   - Enables security monitoring and incident response

6. **Response Data Filtering**
   - Only whitelisted fields returned (id, name, logo, social, description, address)
   - Prevents leaking sensitive/internal data
   - Protects agency privacy

7. **Development Bypass**
   - Only active in `NODE_ENV=development`
   - Requires Postman user-agent
   - Logged for monitoring
   - Disabled in production

### Edge Cases Handled

1. **Missing Referer Header**
   - Response: 403 Forbidden
   - Reason: Required for authorization

2. **Malformed URLs**
   - Graceful handling with `try-catch`
   - Returns 403 for malformed referer
   - Logs error for debugging
   - Skips agencies with malformed website URLs

3. **Multiple Agency Matches**
   - Returns first match (ordered by ID)
   - Logs warning with count and selected agency
   - Ensures deterministic behavior

4. **Origin/Referer Mismatch**
   - Response: 403 Forbidden
   - Logs mismatch event
   - Prevents header spoofing

5. **NULL/Empty Website Values**
   - Excluded from database queries
   - Skipped during iteration
   - Prevents false matches

### Testing Results

All integration tests pass:

✅ **Test 1:** Missing referer header → 403 Forbidden
✅ **Test 2:** Valid allowed referrer → 200 OK
✅ **Test 3:** Unknown referer → 404 Not Found
✅ **Test 4:** Mismatched referer/origin → 403 Forbidden
✅ **Test 5:** Rate limiting functional → Headers present
✅ **Test 6:** Postman dev bypass → Works in development mode

**Test Command Examples:**
```bash
# Test missing referer (expect 403)
curl -X GET http://localhost:5050/api/v1/website/configuration

# Test with allowed referrer (expect 200)
curl -X GET http://localhost:5050/api/v1/website/configuration \
  -H "Referer: http://localhost:3000"

# Test with unknown referrer (expect 404)
curl -X GET http://localhost:5050/api/v1/website/configuration \
  -H "Referer: http://unknown-domain.com"

# Test with mismatched headers (expect 403)
curl -X GET http://localhost:5050/api/v1/website/configuration \
  -H "Referer: http://localhost:3000" \
  -H "Origin: http://different-domain.com"
```

### Performance Considerations

**Current Implementation:**
- Fetches all agencies with social field (filtered by NULL check)
- Normalizes each agency website URL in application code
- O(n) time complexity where n = number of agencies

**Optimization Recommendations:**

1. **Database Index (High Priority):**
   ```sql
   CREATE INDEX idx_agency_website ON "Agency" ((social->>'website'));
   ```
   - Speeds up queries on JSON field
   - Recommended when agency count > 100

2. **Caching (Medium Priority):**
   - Cache agency domain → agency ID mappings
   - Use Redis or in-memory cache
   - TTL: 5-15 minutes
   - Significantly reduces database load

3. **Query Optimization (Future):**
   - Store normalized domain in separate column
   - Use direct WHERE clause instead of application-level filtering
   - Requires migration: `ALTER TABLE "Agency" ADD COLUMN normalized_domain TEXT`

### Documentation

**JSDoc Comments:** ✅ Complete
- All functions have comprehensive JSDoc annotations
- Type hints for IDE IntelliSense
- Examples provided for key functions
- Parameter and return types documented

**Environment Configuration:** ✅ Complete
- `.env.example` updated with ALLOWED_REFERRERS
- Comments explain usage and format
- Example values provided

**Code Comments:** ✅ Complete
- Inline comments explain complex logic
- Performance notes in service layer
- Security considerations documented

### Migration from Next.js

**Key Differences from Original Next.js Implementation:**

1. **URL Matching:**
   - ❌ Old: Bidirectional LIKE pattern matching (security risk)
   - ✅ New: Normalized domain comparison (secure)

2. **Authorization Logic:**
   - ❌ Old: Confusing fallthrough logic
   - ✅ New: Clear sequential checks with early returns

3. **Error Responses:**
   - ❌ Old: Inconsistent response formats
   - ✅ New: Standardized error responses across all paths

4. **Security:**
   - ✅ Added: Origin header cross-validation
   - ✅ Added: Domain-based rate limiting
   - ✅ Added: Security audit logging
   - ✅ Added: Response data filtering

5. **Performance:**
   - ✅ Added: Prisma select for field filtering
   - ✅ Added: Deterministic ordering
   - ✅ Added: Database index recommendation

6. **Maintainability:**
   - ✅ Added: Comprehensive JSDoc comments
   - ✅ Added: Separation of concerns (service/controller)
   - ✅ Added: Utility modules for reusability
   - ✅ Added: Security logger module

### Future Enhancements (Optional)

1. **API Key Authentication (Optional):**
   - Add optional API key support for server-to-server calls
   - Hybrid: Referer for browser, API key for servers

2. **Response Caching:**
   - Cache successful responses per domain
   - Reduce database queries

3. **Webhook Notifications:**
   - Notify agencies of unauthorized access attempts
   - Security monitoring integration

4. **Analytics Dashboard:**
   - Track request volume per agency
   - Monitor unauthorized attempts
   - Performance metrics

5. **CORS Whitelist:**
   - Automatically sync CORS allowed origins with allowed referrers
   - Enhance browser-based security

### Maintenance Notes

**Regular Tasks:**
- Monitor security logs for unusual patterns
- Review rate limit thresholds based on usage
- Update ALLOWED_REFERRERS as needed
- Consider adding database index when agency count grows

**Breaking Changes:**
- If response format changes, coordinate with frontend teams
- If rate limits change, notify agencies in advance

### Contact & Support

For questions about this implementation:
- Review JSDoc comments in source files
- Check security logs for debugging denied requests
- Refer to this documentation for architecture overview

---

**Implementation completed successfully. All requirements met. Production ready.**
