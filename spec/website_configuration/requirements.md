# Requirements Document: Agency Website Configuration API

## Introduction

This feature implements an Express.js API endpoint that allows agency websites to retrieve their configuration data by validating requests based on the HTTP Referer header. This enables agencies to embed widgets or scripts on their websites that automatically authenticate based on the requesting domain, eliminating the need for API key management.

The endpoint migrates functionality from an existing Next.js implementation while improving URL matching, security, and maintainability.

---

## Requirements

### 1. Referer-Based Agency Lookup

**User Story:**
> As an agency website, I want to retrieve my agency configuration by making a request from my domain so that I can display customized content without managing API keys.

**Acceptance Criteria:**
- WHEN a request is received with a valid Referer header THEN the system SHALL query the database to find an agency whose `social.website` field matches the referer domain.
- WHEN a matching agency is found THEN the system SHALL return the agency configuration data with HTTP status 200.
- WHEN no matching agency is found THEN the system SHALL return HTTP status 404 with message "Agency not found".
- WHEN the Referer header is missing or empty THEN the system SHALL return HTTP status 403 with message "forbiddenReferer".

---

### 2. URL Normalization for Matching

**User Story:**
> As an agency, I want my website to be recognized regardless of URL variations (http/https, www prefix, trailing slashes) so that configuration retrieval works consistently.

**Acceptance Criteria:**
- WHEN comparing referer URLs with stored agency website URLs THEN the system SHALL normalize both URLs by:
  - Removing protocol differences (treat http and https as equivalent)
  - Removing www prefix variations
  - Removing trailing slashes
  - Extracting and comparing base domains
- WHEN referer is `https://www.delta.mk/properties/123` and agency website is `http://delta.mk` THEN the system SHALL consider them a match.
- WHEN referer is `http://delta.mk/` and agency website is `https://www.delta.mk` THEN the system SHALL consider them a match.

---

### 3. Static Allowed Referrers List

**User Story:**
> As a system administrator, I want to configure a list of always-allowed referrers via environment variables so that trusted domains can access the API without database lookups.

**Acceptance Criteria:**
- WHEN the environment variable `ALLOWED_REFERRERS` is set THEN the system SHALL parse it as a comma-separated list of allowed domains.
- WHEN a request's referer matches an entry in `ALLOWED_REFERRERS` THEN the system SHALL attempt to find and return the matching agency data.
- WHEN a request matches `ALLOWED_REFERRERS` but no agency is found in the database THEN the system SHALL return HTTP status 404 with message "Agency not found".
- WHEN `ALLOWED_REFERRERS` is not configured THEN the system SHALL default to an empty list.

---

### 4. Development Environment Bypass

**User Story:**
> As a developer, I want to test the API using Postman or similar tools in development mode so that I can debug and develop without needing actual referer headers from a browser.

**Acceptance Criteria:**
- WHEN `NODE_ENV` is "development" AND the User-Agent header contains "postman" (case-insensitive) AND a Referer header is provided THEN the system SHALL allow the request and attempt to find a matching agency.
- WHEN in production mode THEN the system SHALL NOT allow the Postman bypass regardless of User-Agent header.
- WHEN development bypass is used THEN the system SHALL still require a Referer header to perform the agency lookup.

---

### 5. Security: Origin Header Validation

**User Story:**
> As a security-conscious administrator, I want the API to validate both Referer and Origin headers so that spoofing attempts are more difficult.

**Acceptance Criteria:**
- WHEN both Referer and Origin headers are present THEN the system SHALL verify they originate from the same domain.
- WHEN Referer and Origin headers have mismatched domains THEN the system SHALL return HTTP status 403 with message "forbiddenReferer".
- WHEN only Referer header is present (no Origin) THEN the system SHALL proceed with referer-only validation.
- WHEN only Origin header is present (no Referer) THEN the system SHALL use Origin for agency lookup.

---

### 6. Response Data Filtering

**User Story:**
> As an agency, I want to receive only relevant configuration data so that sensitive internal fields are not exposed.

**Acceptance Criteria:**
- WHEN returning agency data THEN the system SHALL include: id, name, logo, social (website, phone, email), description, and address fields.
- WHEN returning agency data THEN the system SHALL exclude sensitive fields such as: internal notes, financial data, user associations, and any fields marked as private.
- WHEN agency data is returned THEN the system SHALL use a consistent response format: `{ data: <agency>, code: 200, message: "Agency configuration loaded successfully" }`.

---

### 7. Error Response Consistency

**User Story:**
> As an API consumer, I want consistent error response formats so that I can handle errors predictably.

**Acceptance Criteria:**
- WHEN returning an error THEN the system SHALL use format: `{ data: undefined, code: <status>, message: <errorKey> }`.
- WHEN referer validation fails THEN the system SHALL return: `{ data: undefined, code: 403, message: "forbiddenReferer" }`.
- WHEN no agency is found THEN the system SHALL return: `{ data: undefined, code: 404, message: "agencyNotFound" }`.
- WHEN an internal error occurs THEN the system SHALL return: `{ data: undefined, code: 500, message: "somethingWentWrong" }`.
- WHEN an internal error occurs THEN the system SHALL log the error details server-side without exposing them to the client.

---

### 8. Rate Limiting

**User Story:**
> As a system administrator, I want requests to be rate-limited per domain so that no single agency website can overwhelm the API.

**Acceptance Criteria:**
- WHEN a domain makes more than 100 requests within 15 minutes THEN the system SHALL return HTTP status 429 with message "tooManyRequests".
- WHEN rate limiting is applied THEN the system SHALL use the normalized referer domain as the rate limit key.
- WHEN a request is rate-limited THEN the response SHALL include `Retry-After` header indicating when requests can resume.

---

### 9. Request Logging for Security Auditing

**User Story:**
> As a security administrator, I want unauthorized access attempts to be logged so that I can monitor and investigate suspicious activity.

**Acceptance Criteria:**
- WHEN a request is denied due to invalid/missing referer THEN the system SHALL log: timestamp, IP address, provided headers (Referer, Origin, User-Agent), and denial reason.
- WHEN a request is denied due to referer/origin mismatch THEN the system SHALL log the mismatch details.
- WHEN logging security events THEN the system SHALL NOT log sensitive data such as cookies or authorization tokens.

---

### 10. Database Query Performance

**User Story:**
> As a system administrator, I want efficient database queries so that the API responds quickly even with many agencies.

**Acceptance Criteria:**
- WHEN querying for an agency by website THEN the system SHALL use domain extraction rather than full URL LIKE matching.
- WHEN an agency is found THEN the system SHALL return only the first match (using LIMIT 1).
- WHEN the database contains agencies with NULL or empty website values THEN the system SHALL exclude them from matching.

---

## Edge Cases and Error Handling

### 11. Edge Case: Multiple Agency Matches

**User Story:**
> As a system administrator, I want predictable behavior when multiple agencies might match a domain so that results are consistent.

**Acceptance Criteria:**
- WHEN multiple agencies have websites that could match the same referer domain THEN the system SHALL return the first match found (deterministic ordering by agency ID).
- WHEN this scenario occurs THEN the system SHALL log a warning for administrator review.

---

### 12. Edge Case: Malformed URLs

**User Story:**
> As an API consumer, I want the system to handle malformed referer URLs gracefully so that errors don't crash the service.

**Acceptance Criteria:**
- WHEN the Referer header contains a malformed URL THEN the system SHALL return HTTP status 403 with message "forbiddenReferer".
- WHEN URL parsing fails THEN the system SHALL log the parsing error for debugging.
- WHEN the stored agency website URL is malformed THEN the system SHALL skip that agency during matching and log a warning.
