# Facebook Property Publication Worker Design

**Status:** Approved design  
**Date:** 2026-07-22  
**Target:** Imotko Express repository, deployed as a separate Railway worker service

## Context

An agency can explicitly consent to publishing an approved property on its connected Facebook Page. The Next.js
application owns Page connection and approval, stores consent in PostgreSQL, and enqueues an identifiers-only BullMQ
job after approval. This repository will own a continuously running worker that reloads authoritative database state,
publishes the current property snapshot to the Page, and records the publication time.

This integration targets Facebook **Pages**, not Facebook Groups. The Page connection, Page access token, and Page feed
endpoints are the relevant Meta APIs.

## Goals

- Consume the existing `facebook-property-publication` BullMQ queue from Upstash Redis.
- Publish one structured Macedonian property post with up to ten images to the agency's connected Facebook Page.
- Recheck current property consent, publication state, content, and Page connection before publishing.
- Retry transient failures using the producer's existing BullMQ job settings.
- Prevent normal duplicate processing by checking and setting `Property.facebookPublishedAt`.
- Run as a low-volume, single-concurrency Railway background service from the same repository as Express.
- Produce useful structured logs without exposing Page tokens or encryption material.

## Non-goals

- Publishing to Facebook Groups or personal profiles.
- Updating or deleting Facebook posts after property edits, unpublishing, or deletion.
- Transactional outbox delivery or periodic reconciliation for failed enqueue operations.
- Persisting a Facebook post ID, publication attempt record, dead-letter table, or property failure fields.
- Rotating `META_TOKEN_ENCRYPTION_KEY` in this version.
- Providing an HTTP endpoint, public Railway domain, or continuous HTTP health check.
- Using the Upstash REST URL or REST token in the worker.

## Existing producer contract

The Next.js producer uses BullMQ `5.80.x`, ioredis `5.11.x`, and the default BullMQ key prefix:

```text
queue: facebook-property-publication
job: publish-approved-property
data: { propertyId, agencyId }
jobId: facebook-property-<propertyId>
```

Producer-owned job settings are:

```js
{
    attempts: 5,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
}
```

The worker must not accept a token, Page ID, description, photo URL, Graph API version, or callback URL from job data.
It treats the two identifiers as untrusted lookup keys and reloads everything else from PostgreSQL.

The queue-only MVP starts after `Queue.add()` succeeds. If PostgreSQL approval commits but Redis enqueue fails, Next.js
must log and recover that failure manually. The worker does not scan the database to reconstruct missing jobs.

## Repository and runtime architecture

The worker will live under `workers/facebook-property-publication/` while sharing the repository's root `package.json`,
lockfile, Prisma schema, generated client, import aliases, and database client.

Proposed module boundaries:

- `index.js`: validate configuration, create Redis and BullMQ connections, start the worker, attach event handlers, and
  perform graceful shutdown.
- `processor.js`: validate job identity, reload state, evaluate eligibility, coordinate uploads and publication, rerun
  the final guard, and persist success.
- `property.repository.js`: isolate Prisma queries, connection-status mutations, and the publication timestamp update.
- `facebook.client.js`: make bounded Graph API requests, parse Graph error bodies, upload unpublished photos, and create
  the final Page feed post.
- `message.js`: validate localized content, convert HTML to text, format property details, and build the canonical URL.
- `crypto.js`: provide the framework-neutral version-1 Page-token decryption contract.
- `errors.js`: define permanent-skip, permanent-Meta, and retryable error categories.
- Adjacent `.spec.js` files: cover formatter, eligibility, crypto compatibility, Graph client, and processor behavior.

Railway runs one replica with BullMQ concurrency `1` using:

```text
pnpm worker:facebook
```

The process connects to Redis with `UPSTASH_REDIS_URL` over TLS and `maxRetriesPerRequest: null`. It does not configure
ioredis `keyPrefix`; BullMQ owns its default key prefix. The worker listens for Redis and BullMQ errors and handles
`SIGTERM` and `SIGINT` by stopping intake, awaiting the active job, closing the worker, disconnecting Redis, and
disconnecting Prisma.

Railway does not need a public domain for this background service. Its restart policy should automatically restart a
crashed process.

## Startup configuration

Startup fails before consuming jobs if any required variable is missing or malformed:

- `DATABASE_URL`
- `UPSTASH_REDIS_URL`, using a `rediss://` Upstash TCP connection string
- `META_TOKEN_ENCRYPTION_KEY`, standard Base64 that decodes to exactly 32 bytes
- `META_GRAPH_API_VERSION`, in version form such as `v24.0`
- `PUBLIC_APP_URL`, configured as the HTTPS origin `https://imotko.mk`

The shared optional database pool settings remain supported:

- `DATABASE_POOL_MAX`
- `DATABASE_POOL_ACQUIRE_TIMEOUT_MS`
- `DATABASE_POOL_IDLE_TIMEOUT_MS`

The worker does not receive `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `META_APP_ID`, `META_APP_SECRET`, or
`META_REDIRECT_URI`. Those values are not needed to publish with an already stored Page access token.

## Authoritative property query

For each recognized job, the processor performs a fresh lookup for the property ID and includes:

- `propertyLocation`
- `agency.facebookConnection`

The query retrieves the current property name, description, status, consent, publication time, slug, photos, listing
type, price fields, size, location fields, and agency relationship. It retrieves the current Page ID, encrypted Page
token, connection status, revision, scopes, Page tasks, expiry fields, and error metadata.

The processor never relies on a property or connection object captured by the producer.

## Eligibility rules

The job is eligible only when all of the following are true:

1. The job name is `publish-approved-property`.
2. `job.data.propertyId` and `job.data.agencyId` are non-empty strings.
3. The property exists.
4. `property.agencyId` equals `job.data.agencyId`.
5. `property.status` is `PUBLISHED`.
6. `property.publishToFacebook` is `true`.
7. `property.facebookPublishedAt` is `null`.
8. `property.slug` is a non-empty string.
9. `property.name.mk` and `property.description.mk` are non-empty strings.
10. At least one valid HTTPS `photos[*].sizes.large` URL exists.
11. The agency and `agency.facebookConnection` exist.
12. The connection status is `CONNECTED`.
13. `pageId` and `encryptedPageToken` are non-empty strings.
14. A non-null `pageTokenExpiresAt` has not passed.
15. A non-null `dataAccessExpiresAt` has not passed.
16. `grantedScopes` includes `pages_manage_posts` and `pages_read_engagement`.
17. `pageTasks` includes a Page task that permits content creation, specifically `CREATE_CONTENT` or `MANAGE`.

Missing property state, removed consent, agency mismatch, existing publication time, missing required content, missing
images, and a disconnected Page produce a successful BullMQ completion with a structured permanent-skip result. They
do not call Meta and do not consume another retry.

If stored expiry or permission information shows that a previously connected Page can no longer publish, the worker
also records the appropriate connection error state before ending the job without retries.

An unknown job name is a producer/configuration fault. It fails with a non-retryable BullMQ error rather than being
silently completed.

## Message construction

The worker builds one deterministic Macedonian message:

```text
{property.name.mk}

🏷️ {За продажба | За изнајмување}
📍 {propertyLocation.name}, {district}
📐 {size} м²
💶 {Цена: 120.000 € | Приближна цена: 120.000 € | Цена: По договор}

{full plain-text description.mk}

🔗 https://imotko.mk/mk/nedviznini/{slug}/{id}
```

Formatting rules:

- `for_sale` maps to `За продажба`; `for_rent` maps to `За изнајмување`.
- The location line joins `propertyLocation.name` and `district` with a comma. It omits a missing component and omits
  the entire line if both are absent.
- Size is rendered as the stored integer followed by `м²`.
- If `price === 0`, the price line is `Цена: По договор`.
- Otherwise, if `hasApproximatePrice === true`, the value is the positive `approximatePrice` when present and falls back
  to `price`; the label is `Приближна цена`.
- Otherwise, the value is `price` and the label is `Цена`.
- `estimationPrice` is ignored.
- Numeric prices use Macedonian thousands grouping and an explicit euro suffix.
- The complete `description.mk` is converted from HTML to readable plain text. HTML entities are decoded, paragraph and
  list breaks are preserved, repeated whitespace is normalized, and there is no application-level truncation.
- `PUBLIC_APP_URL` is normalized without a trailing slash. The Macedonian route is
  `/mk/nedviznini/{encoded slug}/{encoded property ID}`.

A malformed localized value, slug, listing type, or image collection is a permanent content skip rather than a Meta
request.

## Photo selection and upload

The worker walks the stored photo array in order, keeps entries whose `sizes.large` value is a valid HTTPS URL, and
selects the first ten valid URLs. It requires at least one.

Uploads are sequential to preserve order and keep the low-volume worker gentle on Meta rate limits. Each photo is sent
to:

```text
POST https://graph.facebook.com/{META_GRAPH_API_VERSION}/{pageId}/photos
```

with URL-encoded fields:

```text
url=<large image URL>
published=false
access_token=<decrypted Page token>
```

Each response must contain a non-empty photo ID. If any selected upload fails, the processor does not create the visible
feed post. It throws so the entire BullMQ job retries. Earlier unpublished photo objects from that attempt may remain in
Facebook and are accepted as an MVP trade-off.

Every Graph request has a 30-second timeout.

## Final publication guard

Photo uploads do not make a visible Page post. After all uploads succeed and immediately before the feed request, the
worker reloads a compact publication guard from PostgreSQL.

The final guard requires:

- The property still exists, remains `PUBLISHED`, retains consent, belongs to the same agency, and has no publication
  timestamp.
- The Facebook connection still exists, remains `CONNECTED`, has the same Page ID and connection revision, and remains
  unexpired and authorized for publishing.

If the guard changes, the worker completes as skipped and leaves only unpublished Facebook photo objects. It never
creates the visible post after consent is withdrawn or the Page connection is replaced before the final request.

## Creating the Page post

After the final guard passes, the worker sends:

```text
POST https://graph.facebook.com/{META_GRAPH_API_VERSION}/{pageId}/feed
```

with URL-encoded fields:

```text
message=<structured Macedonian message>
attached_media=[{"media_fbid":"..."}, ...]
published=true
access_token=<decrypted Page token>
```

The order of `attached_media` matches the original property image order. The response must contain a non-empty Facebook
post ID before the publication is considered successful.

## Success persistence and idempotency

After receiving a Facebook post ID, the worker sets `Property.facebookPublishedAt` to the current UTC instant. The
timestamp records the fact of publication even if property consent or status changes in the small interval during the
final Graph request.

The update is conditional on the property ID and a null publication timestamp. If no row is changed, the worker reloads
the property:

- An existing timestamp means another execution already recorded success, so the job completes successfully.
- A deleted property produces a critical `published-untracked` log and completes without retrying the already confirmed
  Facebook post.
- A database connectivity error throws and allows BullMQ to retry.

Normal repeat jobs skip because `facebookPublishedAt` is already populated. The fixed producer `jobId` also prevents
duplicate jobs while the retained BullMQ job still exists.

This design intentionally accepts two remaining duplicate windows:

1. Facebook creates the feed post but the HTTP response is lost or times out.
2. Facebook confirms the post but PostgreSQL is temporarily unavailable before the timestamp is stored.

Because the MVP does not persist a Facebook post ID or implement remote reconciliation, a retry can create another Page
post in those cases.

## Token decryption

The worker implements only the decryption half of the existing version-1 envelope. It does not import Next.js
`server-only`.

The contract is:

- AES-256-GCM.
- A standard-Base64 environment key that decodes to exactly 32 bytes.
- A 12-byte random IV.
- A 16-byte authentication tag.
- A Base64URL-encoded JSON envelope with `v`, `iv`, `tag`, and `ciphertext` string fields.
- `v` must equal `1`.
- `createDecipheriv` explicitly receives `authTagLength: 16`.
- IV and tag decoded lengths are checked before decryption.
- Empty plaintext and all authentication failures become a generic `MetaCryptoError`.

There is no key identifier or previous-key fallback. Rotating the environment key requires reconnecting Pages or a
separate migration outside this scope.

The worker never logs the encryption key, encrypted envelope, or decrypted Page token.

## Error classification

### Permanent property skip

Examples include a missing property, agency mismatch, unpublished/deleted state, removed consent, prior publication,
missing Macedonian content, missing slug, or no valid large image. The job completes with:

```js
{
    skipped: true,
    reason: "<stable-machine-readable-reason>",
    propertyId,
}
```

### Permanent Page connection failure

Known expiry, Meta OAuth/token rejection, explicit revocation, or lost Page publishing permission updates the current
`AgencyFacebookConnection` when its revision still matches:

- `EXPIRED` for known token or data-access expiration.
- `REVOKED` for an explicit revocation response.
- `ERROR` for permission loss or ambiguous permanent authentication failure.
- `lastErrorCode` and `lastErrorAt` with sanitized metadata.

The job then stops without consuming all five attempts. Connection updates are revision-guarded so an old job cannot
overwrite a newly reconnected Page.

### Retryable failure

The processor throws a normal error for:

- Network and DNS failures.
- Request timeouts.
- HTTP 408 and 429.
- Meta rate-limit responses.
- Meta 5xx responses.
- Missing or malformed success bodies.
- Any selected photo-upload failure not already classified as a permanent connection failure.
- A non-authentication feed failure.
- Temporary PostgreSQL failures.

BullMQ applies the producer's five attempts and exponential backoff. An exhausted job remains in Redis under the
producer's `removeOnFail: 5000` retention policy.

## Structured logging

Logs are one-line structured objects suitable for Railway. Stable event names include:

- `facebook_worker_started`
- `facebook_job_started`
- `facebook_job_skipped`
- `facebook_photo_uploaded`
- `facebook_post_published`
- `facebook_connection_invalidated`
- `facebook_job_failed`
- `facebook_worker_stopping`
- `facebook_worker_stopped`

Where applicable, logs include job ID, job name, property ID, agency ID, attempt number, photo index, duration, skip or
error category, sanitized Meta code/subcode, Meta trace ID, and confirmed Facebook post ID. They never include access
tokens, encryption inputs, the full property description, or photo URLs.

## Database migration

The existing local migration created `facebookPublishedAt` as `TIMESTAMP(3)`, while operational timestamps in this
schema use timezone-aware values. Because that migration has already been applied locally, implementation adds a new
corrective migration rather than editing migration history.

The Prisma field becomes:

```prisma
facebookPublishedAt DateTime? @db.Timestamptz(3)
```

The corrective SQL interprets any existing naive value as UTC:

```sql
ALTER TABLE "Property"
ALTER COLUMN "facebookPublishedAt" TYPE TIMESTAMPTZ(3)
USING "facebookPublishedAt" AT TIME ZONE 'UTC';
```

No additional property or publication fields are introduced.

## Dependencies and package script

The root package adds BullMQ and ioredis versions compatible with the producer, plus a focused HTML-to-text dependency.
Resolved versions are recorded in the root pnpm lockfile.

The root script is:

```json
"worker:facebook": "node --experimental-transform-types workers/facebook-property-publication/index.js"
```

The worker uses the existing shared Prisma singleton so database pool settings and sensitive-user-field omissions remain
consistent with Express.

## Testing strategy

Automated tests use Node's test runner and dependency injection. They do not create real Facebook posts.

### Message and content tests

- Sale and rent labels.
- Regular, approximate, fallback approximate, and zero/negotiated prices.
- Macedonian thousands grouping and Unicode output.
- HTML elements, entities, paragraphs, lists, and complete untruncated descriptions.
- Both, one, or neither location component.
- Canonical Macedonian Imotko URL construction.
- Invalid localized values, slugs, and listing types.
- Photo filtering, original order, maximum ten, and no-photo skip.

### Crypto tests

- A known version-1 envelope decrypts to the expected token.
- Invalid key length, version, Base64URL, IV length, tag length, ciphertext, and authentication fail generically.
- No token or key appears in error messages or captured logs.

### Graph client tests

- Sequential unpublished-photo requests contain the expected fields.
- Returned photo IDs preserve input order.
- One failed upload prevents the feed request.
- The feed request contains the exact message and `attached_media` order.
- Timeouts, rate limits, 5xx responses, authentication failures, malformed JSON, and missing response IDs are classified
  correctly.
- Meta error codes, subcodes, and trace IDs are sanitized for logs.

### Processor tests

- Happy path publishes and records `facebookPublishedAt` only after a confirmed post ID.
- Every eligibility and permission failure produces the expected skip or connection transition.
- The final guard blocks publication after consent removal, unpublishing, Page disconnection, or revision change.
- A previous publication timestamp prevents all Meta calls.
- Temporary database failure after publication remains retryable.
- A deleted row after confirmed publication logs `published-untracked` without reposting in the same job.
- Unknown job names fail visibly without retries.

## Manual verification

Before Railway deployment:

1. Format touched files.
2. Validate the Prisma schema and generate the client.
3. Run all worker specs, including happy and permission/failure paths.
4. Start the worker against the shared test queue and local/shared test database.
5. Enqueue one eligible property belonging to an explicitly allowlisted Meta test agency.
6. Confirm exactly one Page post with the expected ordered images, Macedonian message, and Imotko link.
7. Confirm `facebookPublishedAt` is populated with a timezone-aware timestamp.
8. Retry or re-enqueue the same property and confirm it skips without calling Meta.
9. Exercise one controlled retryable failure and confirm BullMQ attempts and structured Railway-style logs.
10. Exercise one controlled invalid-token or permission path and confirm the connection state is revision-safely updated.

During Meta testing, the existing Next.js producer must enable consent and enqueue only explicitly allowlisted test
agencies. The test worker and future production worker share the same database and Redis queue, so a worker-side
allowlist would not be sufficient: consuming and skipping another agency's job would remove it from the intended
consumer flow.

## Railway deployment

Create a second Railway service pointing to the same repository and environment resources:

- Custom start command: `pnpm worker:facebook`.
- One replica.
- No generated public domain.
- Automatic restart policy enabled.
- Required worker-only variables configured directly or by Railway references.
- The same PostgreSQL and Upstash Redis endpoints used by the producer.
- Deployment logs reviewed for `facebook_worker_started` and Redis readiness before enabling the producer.

Upstash command usage must be monitored because a continuously running BullMQ worker performs Redis operations even at
low job volume. A fixed Upstash plan should be considered if pay-as-you-go command costs become material.

## Production readiness gate

The first rollout uses Meta test/developer accounts and test Page credentials. Before enabling real agencies:

1. Complete Meta App Review and obtain the required production access for Page publishing.
2. Put the Meta app in Live mode.
3. Replace test app configuration with production values in Next.js and the worker as appropriate.
4. Reconnect or validate the intended production Pages and their stored permissions/tasks.
5. Confirm test-agency producer gating is replaced by the intended production eligibility policy.
6. Run one controlled production Page publication before broad enablement.

## Acceptance criteria

- An eligible queued property produces one Facebook Page post containing up to ten ordered large images and the approved
  Macedonian structured message.
- The worker uses only job identifiers and current PostgreSQL state.
- Consent or Page disconnection before the final feed request prevents visible publication.
- `facebookPublishedAt` is written only after Meta confirms a post ID.
- A property with `facebookPublishedAt` does not publish again during normal processing.
- Missing Macedonian content, slug, or valid photos skips permanently without Meta calls.
- Transient failures retry according to the producer's five-attempt policy.
- Permanent token/permission failures update the connection safely and do not waste retries.
- Failed jobs remain inspectable in BullMQ and all operational outcomes are visible in sanitized Railway logs.
- The worker runs independently from Express with one Railway replica and shuts down gracefully.

## References

- BullMQ connections: <https://docs.bullmq.io/guide/connections>
- BullMQ production guidance: <https://docs.bullmq.io/guide/going-to-production>
- Upstash BullMQ integration: <https://upstash.com/docs/redis/integrations/bullmq>
- Railway background worker guide: <https://docs.railway.com/guides/fullstack-nextjs>
- Node.js crypto API: <https://nodejs.org/download/release/v22.15.1/docs/api/crypto.html>
- Meta Graph API v19 Groups API deprecation announcement:
  <https://developers.facebook.com/blog/post/2024/01/23/introducing-facebook-graph-and-marketing-api-v19/>
