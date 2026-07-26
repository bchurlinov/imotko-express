# Facebook Property Publication Worker

This is a portless, single-concurrency BullMQ consumer for approved Imotko
property publications. It consumes only `{ propertyId, agencyId }` from the
`facebook-property-publication` queue and reloads all property, Page, and
token state from PostgreSQL. It publishes to Facebook Pages only, never Groups
or personal profiles.

## Start command

`pnpm worker:facebook`

The command starts the worker with BullMQ concurrency `1`. It is not an HTTP
service and does not need a listening port or public domain.

## Required variables

`DATABASE_URL`, `UPSTASH_REDIS_URL`, `META_TOKEN_ENCRYPTION_KEY`,
`META_GRAPH_API_VERSION`, and `PUBLIC_APP_URL`.

`UPSTASH_REDIS_URL` must be an Upstash TCP `rediss://` URL. The worker uses
the shared database client, so the optional `DATABASE_POOL_MAX`,
`DATABASE_POOL_ACQUIRE_TIMEOUT_MS`, and `DATABASE_POOL_IDLE_TIMEOUT_MS`
settings remain available. `META_TOKEN_ENCRYPTION_KEY` must be standard
Base64 that decodes to exactly 32 bytes; `META_GRAPH_API_VERSION` must look
like `v24.0`; and `PUBLIC_APP_URL` must be an HTTPS origin. Do not configure
Upstash REST credentials or Meta OAuth application credentials in this worker.

## Railway

Create a second Railway service from the same repository as Express. Configure
one replica, custom start command `pnpm worker:facebook`, automatic restart,
and no public domain. Give it the five required variables and the shared
database-pool settings, plus the same PostgreSQL and Upstash TCP endpoints as
the producer. Do not give it Upstash REST or Meta OAuth app credentials.

After deployment, wait for the `facebook_worker_started` event before enabling
the test producer. This runbook describes the required configuration; it does
not claim that a Railway service or live Meta deployment has been performed.

## Test-mode safety

Until Meta production review is complete, the Next.js producer must enqueue
only explicitly allowlisted test agencies. A worker-side allowlist is not safe
on the shared queue: consuming and skipping another agency's job would remove
it from the intended consumer flow.

Use a Meta test/developer account and Page for the initial checks. Enqueue a
single eligible property, then confirm one `facebook_post_published` event,
the visible Page post, ordered images, the Macedonian message and Imotko URL,
and a non-null timezone-aware `Property.facebookPublishedAt`. Re-enqueueing a
published property must produce `facebook_job_skipped` with
`already-published` before any Meta request.

## Operational outcomes

All logs are one-line JSON objects. The logger permits only stable operational
metadata and never logs Page access tokens, encrypted envelopes, encryption
keys, full descriptions, or image URLs.

### Structured events

- `facebook_worker_started`: Redis and BullMQ are ready to consume jobs.
- `facebook_worker_stopping` and `facebook_worker_stopped`: graceful shutdown
  started and completed after worker, Redis, and Prisma cleanup.
- `facebook_worker_start_failed`, `facebook_worker_shutdown_failed`,
  `facebook_worker_error`, and `facebook_redis_error`: sanitized lifecycle or
  connection failures.
- `facebook_job_started`: a recognized job began; includes its identifiers and
  current attempt.
- `facebook_job_completed`: BullMQ completed a job.
- `facebook_job_skipped`: permanent, successful no-op; includes a stable
  reason.
- `facebook_photo_uploaded`: one unpublished photo upload succeeded; its
  `photoIndex` is zero-based and follows stored property-photo order.
- `facebook_post_published`: Meta returned a Page post ID and timestamp
  persistence reached `recorded`, `already-recorded`, or `deleted`.
- `facebook_connection_invalidated`: a revision-guarded Page connection state
  update was attempted with a sanitized error code.
- `facebook_job_failed`: a BullMQ/processor failure with sanitized category,
  attempt, and safe Meta metadata when available.
- `published-untracked`: Meta confirmed the post but its property row had
  been deleted before `facebookPublishedAt` could be recorded. The confirmed
  post is not retried in that same job.

### Permanent skip reasons

The following reasons complete successfully without a Meta call (or, for the
final guard, without a feed request): `property-not-found`, `agency-mismatch`,
`property-not-published`, `consent-removed`, `already-published`,
`missing-slug`, `missing-macedonian-name`, `missing-macedonian-description`,
`invalid-listing-type`, `missing-photos`, `page-disconnected`,
`missing-page-credentials`, `invalid-facebook-content`, and
`publication-guard-changed`.

Expired, invalid, or insufficient stored Page state also completes without
retry and revision-safely invalidates the current connection: `page-token-expired`
and `data-access-expired` set `EXPIRED`; `invalid-page-token-expiry`,
`invalid-data-access-expiry`, `missing-page-scope`, and `missing-page-task`
set `ERROR`. A malformed stored token produces `ERROR` with
`token-decryption-failed` and stops retries.

### Retryable failures and retained failures

Network and DNS errors, 30-second request timeouts, HTTP 408/429, Meta
rate-limit errors, Meta 5xx responses, malformed responses, missing success
IDs, selected-photo upload failures that are not permanent authorization
failures, non-authentication feed failures, and temporary PostgreSQL failures
are retryable. The producer configures five attempts with exponential backoff.
After the fifth failure, BullMQ retains the failed job for inspection under
the producer's `removeOnFail: 5000` policy.

For a controlled local retry test, use a test double or unreachable Graph base
only in the local harness. Confirm attempts increase to the configured maximum
and that logs contain no token, description, or image URL. Do not change the
production Graph endpoint in committed source.

### Connection invalidation states

Known Page-token or data-access expiry becomes `EXPIRED`. An explicit Meta
revocation (OAuth code 190/subcode 458) becomes `REVOKED`. Permission loss,
ambiguous permanent authentication failure, invalid stored permission data,
or token decryption failure becomes `ERROR`. Every invalidation updates
`lastErrorCode` and `lastErrorAt` only when the connection ID and revision
still match, so an old job cannot overwrite a newly reconnected Page. Permanent
Meta authorization failures stop without using all five attempts.

## Upstash usage

A continuously running BullMQ worker generates Redis activity while idle as
well as while processing jobs. Monitor Upstash command usage and costs; a fixed
Upstash plan may be appropriate when pay-as-you-go command volume becomes
material. Use the TCP Redis URL only; this worker does not use the Upstash REST
API.

## Production readiness

Before enabling real agencies, complete Meta App Review for
`pages_manage_posts` and `pages_read_engagement`, put the Meta app in Live
mode, and configure production credentials in the systems that require them.
Reconnect or validate each production Page and its stored permissions/tasks,
replace test-agency producer gating with the approved production policy, and
perform one controlled production Page post before wider rollout.

## Accepted limitations

- Recovery when PostgreSQL approval succeeds but queue enqueue fails is
  manual; the worker does not scan the database to reconstruct missing jobs.
- Timestamp-only persistence leaves duplicate windows if Meta creates a post
  but its response is lost, or if Meta confirms it but the timestamp update is
  temporarily unavailable.
- Failed attempts can leave orphaned unpublished Facebook photo objects.
- Later property edits, unpublishing, deletion, and Facebook post
  edit/unpublish synchronization are intentionally unsupported.
