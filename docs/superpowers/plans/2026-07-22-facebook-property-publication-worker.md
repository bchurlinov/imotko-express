# Facebook Property Publication Worker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a separately deployable BullMQ worker that publishes eligible Imotko properties to an agency's Facebook Page with structured Macedonian text and up to ten images.

**Architecture:** Add a focused `workers/facebook-property-publication/` module inside the existing package. The Railway worker consumes identifiers-only jobs, reloads PostgreSQL state through the shared Prisma client, uploads unpublished Page photos, rechecks consent and connection revision, creates one Page feed post, and records `facebookPublishedAt`.

**Tech Stack:** Node.js 22 ESM, BullMQ 5.80.x, ioredis 5.11.x, Prisma 7/PostgreSQL, Node `fetch`, AES-256-GCM, `html-to-text`, Node test runner, pnpm, Railway, Upstash Redis, Meta Graph API.

## Global Constraints

- Do not stage or commit any files; the repository owner explicitly requested no commits.
- Preserve all pre-existing staged and unstaged changes, especially the Facebook schema and migration work.
- Use the existing root package, lockfile, Prisma client, generated client, and database adapter; do not create a nested package.
- Use `UPSTASH_REDIS_URL` with the default BullMQ prefix; do not use the Upstash REST credentials in the worker.
- Queue name is `facebook-property-publication`; recognized job name is `publish-approved-property`.
- Job data contains only `{ propertyId, agencyId }`; reload all content, Page data, and token data from PostgreSQL.
- Run one Railway replica with BullMQ concurrency `1` and no public domain.
- Publish to a Facebook Page, never a Group or personal profile.
- Use Macedonian content only; missing `name.mk`, `description.mk`, slug, or valid large images is a permanent skip.
- Select the first ten valid HTTPS `photos[*].sizes.large` URLs in stored order.
- Retry the whole job if any selected image upload fails.
- Use `facebookPublishedAt` as the only persisted publication outcome; do not add a Facebook post ID or publication table.
- Accept the documented duplicate window when Meta succeeds but its response or the timestamp update is lost.
- Do not synchronize later property edits, unpublishing, or deletion to Facebook.
- Use `PUBLIC_APP_URL=https://imotko.mk` and `/mk/nedviznini/{slug}/{id}` for the listing link.
- Never log tokens, encryption material, descriptions, or image URLs.
- Follow repository formatting: 4 spaces, double quotes, no semicolons, Prettier-managed output.

---

## File map

### Create

- `workers/facebook-property-publication/config.js` — validate and normalize worker-only environment configuration.
- `workers/facebook-property-publication/config.spec.js` — startup configuration tests.
- `workers/facebook-property-publication/errors.js` — stable skip reasons and typed Graph/publication errors.
- `workers/facebook-property-publication/crypto.js` — version-1 AES-256-GCM Page-token decryption.
- `workers/facebook-property-publication/crypto.spec.js` — deterministic crypto compatibility and rejection tests.
- `workers/facebook-property-publication/message.js` — localized content extraction, photo selection, HTML conversion, price formatting, and final message construction.
- `workers/facebook-property-publication/message.spec.js` — message and photo-selection tests.
- `workers/facebook-property-publication/eligibility.js` — pure initial eligibility and final-guard evaluation.
- `workers/facebook-property-publication/eligibility.spec.js` — table-driven eligibility tests.
- `workers/facebook-property-publication/property.repository.js` — Prisma reads and revision-guarded writes.
- `workers/facebook-property-publication/property.repository.spec.js` — Prisma call-shape and persistence outcome tests with a fake client.
- `workers/facebook-property-publication/facebook.client.js` — Meta requests, timeouts, response parsing, and error classification.
- `workers/facebook-property-publication/facebook.client.spec.js` — request shape, ordering, timeout, and error tests.
- `workers/facebook-property-publication/logger.js` — explicit structured Railway log events.
- `workers/facebook-property-publication/logger.spec.js` — redaction and stable-field tests.
- `workers/facebook-property-publication/processor.js` — end-to-end job orchestration.
- `workers/facebook-property-publication/processor.spec.js` — happy, skip, race, retry, and permission-path orchestration tests.
- `workers/facebook-property-publication/runtime.js` — BullMQ/Redis lifecycle and graceful shutdown.
- `workers/facebook-property-publication/runtime.spec.js` — worker construction and shutdown-order tests.
- `workers/facebook-property-publication/index.js` — production dependency wiring and process entrypoint.
- `workers/facebook-property-publication/README.md` — local, Railway, test-mode, and operational runbook.
- `prisma/migrations/20260722120000_make_facebook_published_at_timezone_aware/migration.sql` — corrective timezone-aware migration.

### Modify

- `package.json` — add compatible dependencies and worker/test scripts.
- `pnpm-lock.yaml` — lock resolved worker dependencies.
- `.env.example` — document the worker's required variables without changing existing user edits.
- `prisma/schema/property.prisma` — annotate `facebookPublishedAt` as `@db.Timestamptz(3)`.

---

### Task 1: Runtime dependencies and validated configuration

**Files:**

- Create: `workers/facebook-property-publication/config.js`
- Create: `workers/facebook-property-publication/config.spec.js`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `.env.example`

**Interfaces:**

- Produces: `loadFacebookWorkerConfig(env)` returning `{ redisUrl, graphApiVersion, publicAppUrl, tokenEncryptionKey, requestTimeoutMs }`.
- Consumers: Task 6 Graph client, Task 8 production entrypoint.

- [ ] **Step 1: Write failing configuration tests**

```js
import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { loadFacebookWorkerConfig } from "./config.js"

const validEnv = {
    DATABASE_URL: "postgresql://user:pass@localhost:5432/imotko",
    UPSTASH_REDIS_URL: "rediss://default:secret@example.upstash.io:6379",
    META_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
    META_GRAPH_API_VERSION: "v24.0",
    PUBLIC_APP_URL: "https://imotko.mk/",
}

describe("loadFacebookWorkerConfig", () => {
    test("normalizes valid worker configuration", () => {
        assert.deepEqual(loadFacebookWorkerConfig(validEnv), {
            redisUrl: validEnv.UPSTASH_REDIS_URL,
            graphApiVersion: "v24.0",
            publicAppUrl: "https://imotko.mk",
            tokenEncryptionKey: validEnv.META_TOKEN_ENCRYPTION_KEY,
            requestTimeoutMs: 30000,
        })
    })

    for (const key of [
        "DATABASE_URL",
        "UPSTASH_REDIS_URL",
        "META_TOKEN_ENCRYPTION_KEY",
        "META_GRAPH_API_VERSION",
        "PUBLIC_APP_URL",
    ]) {
        test(`rejects missing ${key}`, () => {
            assert.throws(() => loadFacebookWorkerConfig({ ...validEnv, [key]: "" }), new RegExp(key))
        })
    }

    test("rejects a non-TLS Redis URL", () => {
        assert.throws(
            () => loadFacebookWorkerConfig({ ...validEnv, UPSTASH_REDIS_URL: "redis://localhost:6379" }),
            /UPSTASH_REDIS_URL/
        )
    })

    test("rejects a malformed Graph API version", () => {
        assert.throws(() => loadFacebookWorkerConfig({ ...validEnv, META_GRAPH_API_VERSION: "latest" }), /version/)
    })

    test("rejects a key that is not 32 decoded bytes", () => {
        assert.throws(
            () => loadFacebookWorkerConfig({ ...validEnv, META_TOKEN_ENCRYPTION_KEY: "not-a-32-byte-key" }),
            /32 bytes/
        )
    })

    test("rejects a non-HTTPS public app origin", () => {
        assert.throws(
            () => loadFacebookWorkerConfig({ ...validEnv, PUBLIC_APP_URL: "http://imotko.mk" }),
            /PUBLIC_APP_URL/
        )
    })
})
```

- [ ] **Step 2: Run the focused test and verify the missing-module failure**

Run:

```bash
pnpm exec tsx workers/facebook-property-publication/config.spec.js
```

Expected: FAIL because `config.js` does not exist.

- [ ] **Step 3: Implement strict configuration loading**

```js
const requiredString = (env, key) => {
    const value = env[key]
    if (typeof value !== "string" || !value.trim()) throw new Error(`${key} is required`)
    return value.trim()
}

export function loadFacebookWorkerConfig(env = process.env) {
    requiredString(env, "DATABASE_URL")

    const redisUrl = requiredString(env, "UPSTASH_REDIS_URL")
    const parsedRedisUrl = new URL(redisUrl)
    if (parsedRedisUrl.protocol !== "rediss:") throw new Error("UPSTASH_REDIS_URL must use rediss://")

    const tokenEncryptionKey = requiredString(env, "META_TOKEN_ENCRYPTION_KEY")
    if (Buffer.from(tokenEncryptionKey, "base64").length !== 32) {
        throw new Error("META_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes")
    }

    const graphApiVersion = requiredString(env, "META_GRAPH_API_VERSION")
    if (!/^v\d+\.\d+$/.test(graphApiVersion)) throw new Error("META_GRAPH_API_VERSION must be a version like v24.0")

    const publicAppUrl = new URL(requiredString(env, "PUBLIC_APP_URL"))
    if (publicAppUrl.protocol !== "https:") throw new Error("PUBLIC_APP_URL must use https://")

    return {
        redisUrl,
        graphApiVersion,
        publicAppUrl: publicAppUrl.origin,
        tokenEncryptionKey,
        requestTimeoutMs: 30000,
    }
}
```

- [ ] **Step 4: Install compatible dependencies and add scripts**

Run:

```bash
pnpm add bullmq@^5.80.10 ioredis@^5.11.1 html-to-text@^9.0.5
```

Add these scripts to `package.json` without changing existing commands:

```json
"worker:facebook": "node --experimental-transform-types workers/facebook-property-publication/index.js",
"test:facebook-worker": "node --experimental-transform-types --test workers/facebook-property-publication/*.spec.js"
```

Add the Railway runtime constraint at the package root:

```json
"engines": {
    "node": "22.x"
}
```

Append this section to `.env.example` while preserving its current user-owned database-pool edits:

```dotenv
# Facebook property publication worker
UPSTASH_REDIS_URL=rediss://default:password@redis-host.upstash.io:6379
META_TOKEN_ENCRYPTION_KEY=base64-encoded-32-byte-key
META_GRAPH_API_VERSION=v24.0
PUBLIC_APP_URL=https://imotko.mk
```

Do not add the REST credentials or Meta OAuth app credentials to the worker section.

- [ ] **Step 5: Run the focused test and inspect dependency changes**

Run:

```bash
pnpm exec tsx workers/facebook-property-publication/config.spec.js
git diff -- package.json pnpm-lock.yaml .env.example workers/facebook-property-publication/config.js workers/facebook-property-publication/config.spec.js
```

Expected: all configuration tests PASS; the diff contains only the Node 22 runtime constraint, three dependencies, two scripts, worker environment documentation, and the two new configuration files.

- [ ] **Step 6: Stop at an uncommitted review checkpoint**

Verify with `git status --short` that no file was staged and no commit was created.

---

### Task 2: Timezone-aware publication timestamp

**Files:**

- Modify: `prisma/schema/property.prisma`
- Create: `prisma/migrations/20260722120000_make_facebook_published_at_timezone_aware/migration.sql`

**Interfaces:**

- Produces: timezone-aware `Property.facebookPublishedAt` used by Task 5 repository and Task 7 processor.

- [ ] **Step 1: Add the Prisma native timestamp annotation**

Change only the existing field:

```prisma
facebookPublishedAt DateTime? @db.Timestamptz(3)
```

- [ ] **Step 2: Add a corrective migration rather than editing the applied migration**

```sql
-- Interpret existing naive publication timestamps as UTC and store future values with timezone awareness.
ALTER TABLE "Property"
ALTER COLUMN "facebookPublishedAt" TYPE TIMESTAMPTZ(3)
USING "facebookPublishedAt" AT TIME ZONE 'UTC';
```

- [ ] **Step 3: Validate and regenerate Prisma artifacts**

Run with the repository's normal local database environment loaded:

```bash
pnpm prisma validate
pnpm prisma generate
```

Expected: Prisma schema validation succeeds and the generated client exposes `facebookPublishedAt` as nullable `Date`.

- [ ] **Step 4: Apply the corrective migration locally**

Run:

```bash
pnpm prisma migrate dev
```

Expected: only `20260722120000_make_facebook_published_at_timezone_aware` is newly applied; Prisma reports the database schema is in sync.

- [ ] **Step 5: Verify the PostgreSQL column type**

Run in Prisma Studio or the local PostgreSQL console:

```sql
SELECT data_type
FROM information_schema.columns
WHERE table_name = 'Property' AND column_name = 'facebookPublishedAt';
```

Expected: `timestamp with time zone`.

- [ ] **Step 6: Stop at an uncommitted review checkpoint**

Confirm the original applied Facebook migrations remain byte-for-byte unchanged.

---

### Task 3: Versioned Page-token decryption

**Files:**

- Create: `workers/facebook-property-publication/errors.js`
- Create: `workers/facebook-property-publication/crypto.js`
- Create: `workers/facebook-property-publication/crypto.spec.js`

**Interfaces:**

- Produces: `MetaCryptoError`, `FacebookApiError`, `RetryablePublicationError`, and `decryptMetaToken(encryptedToken, tokenEncryptionKey)`.
- Consumers: Task 6 Facebook client and Task 7 processor.

- [ ] **Step 1: Write deterministic decryption and rejection tests**

```js
import assert from "node:assert/strict"
import { createCipheriv } from "node:crypto"
import { describe, test } from "node:test"
import { decryptMetaToken } from "./crypto.js"
import { MetaCryptoError } from "./errors.js"

const key = Buffer.alloc(32, 7)
const keyBase64 = key.toString("base64")

const envelopeFor = (plaintext, overrides = {}) => {
    const iv = Buffer.alloc(12, 3)
    const cipher = createCipheriv("aes-256-gcm", key, iv)
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
    const envelope = {
        v: 1,
        iv: iv.toString("base64url"),
        tag: cipher.getAuthTag().toString("base64url"),
        ciphertext: ciphertext.toString("base64url"),
        ...overrides,
    }
    return Buffer.from(JSON.stringify(envelope), "utf8").toString("base64url")
}

describe("decryptMetaToken", () => {
    test("decrypts the Next.js version-1 envelope", () => {
        assert.equal(decryptMetaToken(envelopeFor("page-access-token"), keyBase64), "page-access-token")
    })

    test("rejects unsupported versions", () => {
        assert.throws(() => decryptMetaToken(envelopeFor("token", { v: 2 }), keyBase64), MetaCryptoError)
    })

    test("rejects invalid IV and tag lengths", () => {
        assert.throws(() => decryptMetaToken(envelopeFor("token", { iv: "AA" }), keyBase64), MetaCryptoError)
        assert.throws(() => decryptMetaToken(envelopeFor("token", { tag: "AA" }), keyBase64), MetaCryptoError)
    })

    test("rejects tampered ciphertext without exposing inputs", () => {
        const encrypted = envelopeFor("secret-page-token", { ciphertext: "AA" })
        assert.throws(
            () => decryptMetaToken(encrypted, keyBase64),
            error => error instanceof MetaCryptoError && !error.message.includes("secret-page-token")
        )
    })
})
```

- [ ] **Step 2: Run the focused test and verify failure**

Run `pnpm exec tsx workers/facebook-property-publication/crypto.spec.js`.

Expected: FAIL because `crypto.js` and `errors.js` do not exist.

- [ ] **Step 3: Define typed errors**

```js
export class MetaCryptoError extends Error {
    constructor(message) {
        super(message)
        this.name = "MetaCryptoError"
    }
}

export class FacebookApiError extends Error {
    constructor(
        message,
        { connectionStatus = null, errorCode = null, metaCode = null, metaSubcode = null, fbtraceId = null } = {}
    ) {
        super(message)
        this.name = "FacebookApiError"
        this.connectionStatus = connectionStatus
        this.errorCode = errorCode
        this.metaCode = metaCode
        this.metaSubcode = metaSubcode
        this.fbtraceId = fbtraceId
    }
}

export class RetryablePublicationError extends Error {
    constructor(message, { errorCode = null, metaCode = null, metaSubcode = null, fbtraceId = null, cause } = {}) {
        super(message, { cause })
        this.name = "RetryablePublicationError"
        this.errorCode = errorCode
        this.metaCode = metaCode
        this.metaSubcode = metaSubcode
        this.fbtraceId = fbtraceId
    }
}
```

- [ ] **Step 4: Implement framework-neutral authenticated decryption**

```js
import { createDecipheriv } from "node:crypto"
import { MetaCryptoError } from "./errors.js"

const ENVELOPE_VERSION = 1
const IV_LENGTH = 12
const TAG_LENGTH = 16

const invalidToken = () => new MetaCryptoError("Invalid encrypted Meta token")

const parseKey = tokenEncryptionKey => {
    const key = Buffer.from(tokenEncryptionKey || "", "base64")
    if (key.length !== 32) throw new MetaCryptoError("Invalid Meta token encryption key")
    return key
}

const parseEnvelope = encryptedToken => {
    try {
        const envelope = JSON.parse(Buffer.from(encryptedToken, "base64url").toString("utf8"))
        if (
            envelope?.v !== ENVELOPE_VERSION ||
            typeof envelope.iv !== "string" ||
            typeof envelope.tag !== "string" ||
            typeof envelope.ciphertext !== "string"
        ) {
            throw invalidToken()
        }

        const iv = Buffer.from(envelope.iv, "base64url")
        const tag = Buffer.from(envelope.tag, "base64url")
        const ciphertext = Buffer.from(envelope.ciphertext, "base64url")
        if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH || ciphertext.length === 0) throw invalidToken()
        return { iv, tag, ciphertext }
    } catch {
        throw invalidToken()
    }
}

export function decryptMetaToken(encryptedToken, tokenEncryptionKey) {
    if (typeof encryptedToken !== "string" || !encryptedToken) throw invalidToken()
    const key = parseKey(tokenEncryptionKey)
    const { iv, tag, ciphertext } = parseEnvelope(encryptedToken)

    try {
        const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_LENGTH })
        decipher.setAuthTag(tag)
        const token = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
        if (!token) throw invalidToken()
        return token
    } catch {
        throw invalidToken()
    }
}
```

- [ ] **Step 5: Run focused tests**

Run `pnpm exec tsx workers/facebook-property-publication/crypto.spec.js`.

Expected: all crypto tests PASS.

- [ ] **Step 6: Stop at an uncommitted review checkpoint**

Confirm neither `server-only` nor encryption helpers unrelated to Page-token decryption were added.

---

### Task 4: Macedonian message and photo selection

**Files:**

- Create: `workers/facebook-property-publication/message.js`
- Create: `workers/facebook-property-publication/message.spec.js`

**Interfaces:**

- Produces: `selectLargePhotoUrls(photos, limit = 10)` and `buildPropertyMessage(property, publicAppUrl)`.
- Consumers: Task 7 processor.

- [ ] **Step 1: Write formatter and image-selection tests**

```js
import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { buildPropertyMessage, selectLargePhotoUrls } from "./message.js"

const property = {
    id: "property-1",
    slug: "stan-vo-centar",
    name: { mk: "Стан во Центар" },
    description: { mk: "<p>Прв пасус &amp; детали.</p><p>Втор пасус.</p>" },
    listingType: "for_sale",
    price: 120000,
    hasApproximatePrice: false,
    approximatePrice: null,
    size: 85,
    district: "Центар",
    propertyLocation: { name: "Скопје" },
}

describe("selectLargePhotoUrls", () => {
    test("keeps the first ten valid HTTPS large URLs in order", () => {
        const photos = Array.from({ length: 12 }, (_, index) => ({
            sizes: { large: `https://images.example/${index}.jpg` },
        }))
        photos.splice(2, 0, { sizes: { large: "http://images.example/insecure.jpg" } })
        assert.deepEqual(
            selectLargePhotoUrls(photos),
            Array.from({ length: 10 }, (_, index) => `https://images.example/${index}.jpg`)
        )
    })

    test("returns an empty array for malformed photo JSON", () => {
        assert.deepEqual(selectLargePhotoUrls(null), [])
        assert.deepEqual(selectLargePhotoUrls({}), [])
    })
})

describe("buildPropertyMessage", () => {
    test("builds the approved structured Macedonian sale message", () => {
        assert.equal(
            buildPropertyMessage(property, "https://imotko.mk"),
            [
                "Стан во Центар",
                "",
                "🏷️ За продажба",
                "📍 Скопје, Центар",
                "📐 85 м²",
                "💶 Цена: 120.000 €",
                "",
                "Прв пасус & детали.\n\nВтор пасус.",
                "",
                "🔗 https://imotko.mk/mk/nedviznini/stan-vo-centar/property-1",
            ].join("\n")
        )
    })

    test("formats rent, approximate price, negotiated price, and missing location parts", () => {
        assert.match(
            buildPropertyMessage(
                { ...property, listingType: "for_rent", hasApproximatePrice: true, approximatePrice: 95000 },
                "https://imotko.mk"
            ),
            /🏷️ За изнајмување[\s\S]*💶 Приближна цена: 95\.000 €/
        )
        assert.match(buildPropertyMessage({ ...property, price: 0 }, "https://imotko.mk"), /💶 Цена: По договор/)
        assert.doesNotMatch(
            buildPropertyMessage({ ...property, district: null, propertyLocation: null }, "https://imotko.mk"),
            /📍/
        )
    })

    test("uses price when approximatePrice is absent or non-positive", () => {
        assert.match(
            buildPropertyMessage({ ...property, hasApproximatePrice: true, approximatePrice: 0 }, "https://imotko.mk"),
            /Приближна цена: 120\.000 €/
        )
    })

    test("rejects missing Macedonian content, slug, or unknown listing type", () => {
        assert.throws(() => buildPropertyMessage({ ...property, name: {} }, "https://imotko.mk"), /name\.mk/)
        assert.throws(
            () => buildPropertyMessage({ ...property, description: { mk: "" } }, "https://imotko.mk"),
            /description\.mk/
        )
        assert.throws(() => buildPropertyMessage({ ...property, slug: null }, "https://imotko.mk"), /slug/)
        assert.throws(
            () => buildPropertyMessage({ ...property, listingType: "unknown" }, "https://imotko.mk"),
            /listingType/
        )
    })
})
```

- [ ] **Step 2: Run the test and verify the missing-module failure**

Run `pnpm exec tsx workers/facebook-property-publication/message.spec.js`.

Expected: FAIL because `message.js` does not exist.

- [ ] **Step 3: Implement deterministic formatting and photo selection**

```js
import { convert } from "html-to-text"

const nonEmptyString = value => (typeof value === "string" && value.trim() ? value.trim() : null)

const localizedString = (value, fieldName) => {
    const localized = value && typeof value === "object" && !Array.isArray(value) ? nonEmptyString(value.mk) : null
    if (!localized) throw new Error(`${fieldName}.mk is required`)
    return localized
}

const plainTextDescription = html =>
    convert(html, {
        wordwrap: false,
        preserveNewlines: true,
        selectors: [
            { selector: "a", options: { ignoreHref: true } },
            { selector: "img", format: "skip" },
        ],
    })
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()

const formatNumber = value => new Intl.NumberFormat("mk-MK", { maximumFractionDigits: 0 }).format(value)

const formatPrice = property => {
    if (property.price === 0) return "Цена: По договор"
    if (property.hasApproximatePrice === true) {
        const value =
            Number.isInteger(property.approximatePrice) && property.approximatePrice > 0
                ? property.approximatePrice
                : property.price
        return `Приближна цена: ${formatNumber(value)} €`
    }
    return `Цена: ${formatNumber(property.price)} €`
}

export function selectLargePhotoUrls(photos, limit = 10) {
    if (!Array.isArray(photos)) return []
    return photos
        .map(photo => photo?.sizes?.large)
        .filter(value => {
            if (typeof value !== "string") return false
            try {
                return new URL(value).protocol === "https:"
            } catch {
                return false
            }
        })
        .slice(0, limit)
}

export function buildPropertyMessage(property, publicAppUrl) {
    const title = localizedString(property.name, "name")
    const descriptionHtml = localizedString(property.description, "description")
    const description = plainTextDescription(descriptionHtml)
    if (!description) throw new Error("description.mk must contain text")

    const slug = nonEmptyString(property.slug)
    if (!slug) throw new Error("slug is required")

    const listingLabel = { for_sale: "За продажба", for_rent: "За изнајмување" }[property.listingType]
    if (!listingLabel) throw new Error("listingType is invalid")

    const location = [nonEmptyString(property.propertyLocation?.name), nonEmptyString(property.district)]
        .filter(Boolean)
        .join(", ")
    const propertyUrl = new URL(
        `/mk/nedviznini/${encodeURIComponent(slug)}/${encodeURIComponent(property.id)}`,
        publicAppUrl
    ).toString()

    return [
        title,
        "",
        `🏷️ ${listingLabel}`,
        ...(location ? [`📍 ${location}`] : []),
        `📐 ${property.size} м²`,
        `💶 ${formatPrice(property)}`,
        "",
        description,
        "",
        `🔗 ${propertyUrl}`,
    ].join("\n")
}
```

- [ ] **Step 4: Run formatter tests and format the files**

Run:

```bash
pnpm exec tsx workers/facebook-property-publication/message.spec.js
pnpm exec prettier --write workers/facebook-property-publication/message.js workers/facebook-property-publication/message.spec.js
```

Expected: all formatter tests PASS and Prettier reports both files formatted.

- [ ] **Step 5: Stop at an uncommitted review checkpoint**

Review one rendered sample against the approved template and confirm the full description is not truncated.

---

### Task 5: Pure eligibility rules and Prisma repository

**Files:**

- Create: `workers/facebook-property-publication/eligibility.js`
- Create: `workers/facebook-property-publication/eligibility.spec.js`
- Create: `workers/facebook-property-publication/property.repository.js`
- Create: `workers/facebook-property-publication/property.repository.spec.js`

**Interfaces:**

- Produces: `evaluatePublicationEligibility(property, agencyId, now)`, `isPublicationGuardCurrent(initial, guard, agencyId, now)`, and `createPropertyRepository(prisma)`.
- Repository methods: `loadProperty(propertyId)`, `loadPublicationGuard(propertyId)`, `invalidateConnection(input)`, `recordPublished(propertyId, publishedAt)`.
- Consumers: Task 7 processor.

- [ ] **Step 1: Write table-driven eligibility tests**

```js
import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { evaluatePublicationEligibility, isPublicationGuardCurrent } from "./eligibility.js"

const future = new Date("2030-01-01T00:00:00.000Z")
const now = new Date("2026-07-22T12:00:00.000Z")
const eligibleProperty = {
    id: "property-1",
    agencyId: "agency-1",
    status: "PUBLISHED",
    publishToFacebook: true,
    facebookPublishedAt: null,
    slug: "stan",
    name: { mk: "Стан" },
    description: { mk: "<p>Опис</p>" },
    photos: [{ sizes: { large: "https://images.example/1.jpg" } }],
    agency: {
        facebookConnection: {
            id: "connection-1",
            revision: 3,
            status: "CONNECTED",
            pageId: "page-1",
            encryptedPageToken: "encrypted",
            pageTokenExpiresAt: future,
            dataAccessExpiresAt: future,
            grantedScopes: ["pages_manage_posts", "pages_read_engagement"],
            pageTasks: ["CREATE_CONTENT"],
        },
    },
}

describe("evaluatePublicationEligibility", () => {
    test("accepts the complete publishable state", () => {
        assert.deepEqual(evaluatePublicationEligibility(eligibleProperty, "agency-1", now), { eligible: true })
    })

    for (const [reason, change] of [
        ["property-not-found", () => null],
        ["agency-mismatch", value => ({ ...value, agencyId: "other" })],
        ["property-not-published", value => ({ ...value, status: "UNPUBLISHED" })],
        ["consent-removed", value => ({ ...value, publishToFacebook: false })],
        ["already-published", value => ({ ...value, facebookPublishedAt: now })],
        ["missing-slug", value => ({ ...value, slug: null })],
        ["missing-macedonian-name", value => ({ ...value, name: {} })],
        ["missing-macedonian-description", value => ({ ...value, description: {} })],
        ["invalid-listing-type", value => ({ ...value, listingType: "unknown" })],
        ["missing-photos", value => ({ ...value, photos: [] })],
        [
            "page-disconnected",
            value => ({
                ...value,
                agency: { facebookConnection: { ...value.agency.facebookConnection, status: "DISCONNECTED" } },
            }),
        ],
    ]) {
        test(`skips ${reason}`, () => {
            const candidate = change ? change(eligibleProperty) : eligibleProperty
            assert.equal(evaluatePublicationEligibility(candidate, "agency-1", now).reason, reason)
        })
    }

    test("invalidates a known expired connection", () => {
        const property = {
            ...eligibleProperty,
            agency: {
                facebookConnection: { ...eligibleProperty.agency.facebookConnection, pageTokenExpiresAt: now },
            },
        }
        assert.deepEqual(evaluatePublicationEligibility(property, "agency-1", now), {
            eligible: false,
            reason: "page-token-expired",
            connectionStatus: "EXPIRED",
            errorCode: "page-token-expired",
        })
    })

    test("final guard rejects a changed connection revision", () => {
        const initial = eligibleProperty.agency.facebookConnection
        const guard = {
            ...eligibleProperty,
            agency: { facebookConnection: { ...initial, revision: initial.revision + 1 } },
        }
        assert.equal(isPublicationGuardCurrent(initial, guard, "agency-1", now), false)
    })
})
```

- [ ] **Step 2: Write repository interaction tests with a fake Prisma client**

```js
import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { createPropertyRepository } from "./property.repository.js"

describe("property repository", () => {
    test("records a publication only while the timestamp is null", async () => {
        const calls = []
        const prisma = {
            property: {
                updateMany: async args => {
                    calls.push(args)
                    return { count: 1 }
                },
            },
        }
        const repository = createPropertyRepository(prisma)
        const publishedAt = new Date("2026-07-22T12:00:00.000Z")
        assert.deepEqual(await repository.recordPublished("property-1", publishedAt), { outcome: "recorded" })
        assert.deepEqual(calls[0].where, { id: "property-1", facebookPublishedAt: null })
    })

    test("revision-guards connection invalidation", async () => {
        let received
        const prisma = { agencyFacebookConnection: { updateMany: async args => ((received = args), { count: 1 }) } }
        const repository = createPropertyRepository(prisma)
        await repository.invalidateConnection({
            connectionId: "connection-1",
            revision: 4,
            status: "ERROR",
            errorCode: "meta-200",
            errorAt: new Date("2026-07-22T12:00:00.000Z"),
        })
        assert.deepEqual(received.where, { id: "connection-1", revision: 4 })
    })
})
```

- [ ] **Step 3: Run both tests and verify missing-module failures**

Run:

```bash
pnpm exec tsx workers/facebook-property-publication/eligibility.spec.js
pnpm exec tsx workers/facebook-property-publication/property.repository.spec.js
```

Expected: both fail because their implementation modules do not exist.

- [ ] **Step 4: Implement pure eligibility decisions**

Implement `eligibility.js` with stable results in this order so the first reason is deterministic:

```js
import { selectLargePhotoUrls } from "./message.js"

const hasMk = value => value && typeof value === "object" && typeof value.mk === "string" && value.mk.trim()
const expired = (value, now) => value instanceof Date && value <= now

export function evaluatePublicationEligibility(property, agencyId, now = new Date()) {
    if (!property) return { eligible: false, reason: "property-not-found" }
    if (property.agencyId !== agencyId) return { eligible: false, reason: "agency-mismatch" }
    if (property.status !== "PUBLISHED") return { eligible: false, reason: "property-not-published" }
    if (property.publishToFacebook !== true) return { eligible: false, reason: "consent-removed" }
    if (property.facebookPublishedAt) return { eligible: false, reason: "already-published" }
    if (typeof property.slug !== "string" || !property.slug.trim()) return { eligible: false, reason: "missing-slug" }
    if (!hasMk(property.name)) return { eligible: false, reason: "missing-macedonian-name" }
    if (!hasMk(property.description)) return { eligible: false, reason: "missing-macedonian-description" }
    if (!["for_sale", "for_rent"].includes(property.listingType))
        return { eligible: false, reason: "invalid-listing-type" }
    if (selectLargePhotoUrls(property.photos).length === 0) return { eligible: false, reason: "missing-photos" }

    const connection = property.agency?.facebookConnection
    if (!connection || connection.status !== "CONNECTED") return { eligible: false, reason: "page-disconnected" }
    if (!connection.pageId || !connection.encryptedPageToken)
        return { eligible: false, reason: "missing-page-credentials" }
    if (expired(connection.pageTokenExpiresAt, now)) {
        return {
            eligible: false,
            reason: "page-token-expired",
            connectionStatus: "EXPIRED",
            errorCode: "page-token-expired",
        }
    }
    if (expired(connection.dataAccessExpiresAt, now)) {
        return {
            eligible: false,
            reason: "data-access-expired",
            connectionStatus: "EXPIRED",
            errorCode: "data-access-expired",
        }
    }
    if (!["pages_manage_posts", "pages_read_engagement"].every(scope => connection.grantedScopes.includes(scope))) {
        return {
            eligible: false,
            reason: "missing-page-scope",
            connectionStatus: "ERROR",
            errorCode: "missing-page-scope",
        }
    }
    if (!["CREATE_CONTENT", "MANAGE"].some(task => connection.pageTasks.includes(task))) {
        return {
            eligible: false,
            reason: "missing-page-task",
            connectionStatus: "ERROR",
            errorCode: "missing-page-task",
        }
    }
    return { eligible: true }
}

export function isPublicationGuardCurrent(initialConnection, property, agencyId, now = new Date()) {
    if (!evaluatePublicationEligibility(property, agencyId, now).eligible) return false
    const current = property.agency.facebookConnection
    return current.pageId === initialConnection.pageId && current.revision === initialConnection.revision
}
```

- [ ] **Step 5: Implement the repository using narrow Prisma selections**

`loadProperty(propertyId)` selects exactly the fields consumed by eligibility, message construction, and token handling;
`loadPublicationGuard(propertyId)` selects only guard fields. Implement write methods as follows:

```js
export function createPropertyRepository(prisma) {
    return {
        loadProperty: propertyId =>
            prisma.property.findUnique({
                where: { id: propertyId },
                select: {
                    id: true,
                    agencyId: true,
                    status: true,
                    publishToFacebook: true,
                    facebookPublishedAt: true,
                    slug: true,
                    name: true,
                    description: true,
                    photos: true,
                    listingType: true,
                    price: true,
                    hasApproximatePrice: true,
                    approximatePrice: true,
                    size: true,
                    district: true,
                    propertyLocation: { select: { name: true } },
                    agency: {
                        select: {
                            facebookConnection: {
                                select: {
                                    id: true,
                                    revision: true,
                                    status: true,
                                    pageId: true,
                                    encryptedPageToken: true,
                                    pageTokenExpiresAt: true,
                                    dataAccessExpiresAt: true,
                                    grantedScopes: true,
                                    pageTasks: true,
                                },
                            },
                        },
                    },
                },
            }),

        loadPublicationGuard: propertyId =>
            prisma.property.findUnique({
                where: { id: propertyId },
                select: {
                    id: true,
                    agencyId: true,
                    status: true,
                    publishToFacebook: true,
                    facebookPublishedAt: true,
                    slug: true,
                    name: true,
                    description: true,
                    photos: true,
                    listingType: true,
                    agency: {
                        select: {
                            facebookConnection: {
                                select: {
                                    id: true,
                                    revision: true,
                                    status: true,
                                    pageId: true,
                                    encryptedPageToken: true,
                                    pageTokenExpiresAt: true,
                                    dataAccessExpiresAt: true,
                                    grantedScopes: true,
                                    pageTasks: true,
                                },
                            },
                        },
                    },
                },
            }),

        invalidateConnection: ({ connectionId, revision, status, errorCode, errorAt }) =>
            prisma.agencyFacebookConnection.updateMany({
                where: { id: connectionId, revision },
                data: { status, lastErrorCode: errorCode, lastErrorAt: errorAt },
            }),

        async recordPublished(propertyId, publishedAt) {
            const result = await prisma.property.updateMany({
                where: { id: propertyId, facebookPublishedAt: null },
                data: { facebookPublishedAt: publishedAt },
            })
            if (result.count === 1) return { outcome: "recorded" }

            const property = await prisma.property.findUnique({
                where: { id: propertyId },
                select: { facebookPublishedAt: true },
            })
            if (!property) return { outcome: "deleted" }
            if (property.facebookPublishedAt) return { outcome: "already-recorded" }
            return { outcome: "not-recorded" }
        },
    }
}
```

- [ ] **Step 6: Run all Task 5 tests**

Run both focused spec files. Expected: all tests PASS, including exact Prisma `where` clauses.

- [ ] **Step 7: Stop at an uncommitted review checkpoint**

Confirm no token, photo, or description can enter through the job payload and every write is revision- or null-guarded.

---

### Task 6: Meta Graph API client and error classification

**Files:**

- Create: `workers/facebook-property-publication/facebook.client.js`
- Create: `workers/facebook-property-publication/facebook.client.spec.js`
- Modify: `workers/facebook-property-publication/errors.js`

**Interfaces:**

- Produces: `createFacebookClient({ fetchImpl, graphApiVersion, timeoutMs })` with `uploadUnpublishedPhoto(input)` and `createPagePost(input)`.
- Throws: `FacebookApiError` for permanent token/permission failures and `RetryablePublicationError` for retryable failures.
- Consumers: Task 7 processor and Task 8 entrypoint.

- [ ] **Step 1: Write request-shape and ordering tests**

```js
import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { FacebookApiError, RetryablePublicationError } from "./errors.js"
import { createFacebookClient } from "./facebook.client.js"

const response = (status, body) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
    })

describe("Facebook client", () => {
    test("uploads an unpublished photo with the Page token", async () => {
        let request
        const client = createFacebookClient({
            graphApiVersion: "v24.0",
            timeoutMs: 30000,
            fetchImpl: async (url, options) => ((request = { url, options }), response(200, { id: "photo-1" })),
        })
        assert.equal(
            await client.uploadUnpublishedPhoto({
                pageId: "page-1",
                imageUrl: "https://images.example/1.jpg",
                accessToken: "token",
            }),
            "photo-1"
        )
        assert.equal(request.url, "https://graph.facebook.com/v24.0/page-1/photos")
        assert.equal(request.options.body.get("published"), "false")
        assert.equal(request.options.body.get("access_token"), "token")
    })

    test("creates the final post with ordered attached_media", async () => {
        let body
        const client = createFacebookClient({
            graphApiVersion: "v24.0",
            timeoutMs: 30000,
            fetchImpl: async (_url, options) => ((body = options.body), response(200, { id: "page-1_post-1" })),
        })
        const postId = await client.createPagePost({
            pageId: "page-1",
            message: "Порака",
            photoIds: ["photo-1", "photo-2"],
            accessToken: "token",
        })
        assert.equal(postId, "page-1_post-1")
        assert.deepEqual(JSON.parse(body.get("attached_media")), [{ media_fbid: "photo-1" }, { media_fbid: "photo-2" }])
        assert.equal(body.get("published"), "true")
    })

    test("classifies expired, revoked, and permission errors as permanent", async () => {
        for (const [error, expectedStatus] of [
            [{ code: 190, error_subcode: 463 }, "EXPIRED"],
            [{ code: 190, error_subcode: 458 }, "REVOKED"],
            [{ code: 200 }, "ERROR"],
        ]) {
            const client = createFacebookClient({
                graphApiVersion: "v24.0",
                timeoutMs: 30000,
                fetchImpl: async () =>
                    response(400, { error: { message: "Rejected", fbtrace_id: "trace-1", ...error } }),
            })
            await assert.rejects(
                () =>
                    client.uploadUnpublishedPhoto({
                        pageId: "page-1",
                        imageUrl: "https://images.example/1.jpg",
                        accessToken: "token",
                    }),
                value => value instanceof FacebookApiError && value.connectionStatus === expectedStatus
            )
        }
    })

    test("classifies rate limits, server errors, timeouts, and missing IDs as retryable", async () => {
        for (const fetchImpl of [
            async () => response(429, { error: { code: 4, message: "Rate limited" } }),
            async () => response(503, { error: { code: 2, message: "Unavailable" } }),
            async () => response(200, {}),
        ]) {
            const client = createFacebookClient({ graphApiVersion: "v24.0", timeoutMs: 30000, fetchImpl })
            await assert.rejects(
                () =>
                    client.uploadUnpublishedPhoto({
                        pageId: "page-1",
                        imageUrl: "https://images.example/1.jpg",
                        accessToken: "token",
                    }),
                RetryablePublicationError
            )
        }
    })
})
```

- [ ] **Step 2: Run the focused test and verify failure**

Run `pnpm exec tsx workers/facebook-property-publication/facebook.client.spec.js`.

Expected: FAIL because `facebook.client.js` does not exist.

- [ ] **Step 3: Implement one bounded request helper and the two Graph methods**

```js
import { FacebookApiError, RetryablePublicationError } from "./errors.js"

const connectionStatusFor = error => {
    if (error?.code === 190 && error?.error_subcode === 458) return "REVOKED"
    if (error?.code === 190 && error?.error_subcode === 463) return "EXPIRED"
    if (error?.code === 190 || error?.code === 10 || error?.code === 200) return "ERROR"
    return null
}

export function createFacebookClient({ fetchImpl = fetch, graphApiVersion, timeoutMs }) {
    const request = async (path, fields, expectedIdField = "id") => {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), timeoutMs)
        let response
        let payload

        try {
            response = await fetchImpl(`https://graph.facebook.com/${graphApiVersion}/${path}`, {
                method: "POST",
                body: new URLSearchParams(fields),
                signal: controller.signal,
            })
            payload = await response.json()
        } catch (error) {
            throw new RetryablePublicationError(
                error?.name === "AbortError" ? "Facebook request timed out" : "Facebook request failed",
                {
                    errorCode: error?.name === "AbortError" ? "timeout" : "network",
                    cause: error,
                }
            )
        } finally {
            clearTimeout(timeout)
        }

        if (!response.ok || payload?.error) {
            const meta = payload?.error || {}
            const connectionStatus = connectionStatusFor(meta)
            const details = {
                errorCode: `meta-${meta.code || response.status}`,
                metaCode: meta.code || null,
                metaSubcode: meta.error_subcode || null,
                fbtraceId: meta.fbtrace_id || null,
            }
            if (connectionStatus)
                throw new FacebookApiError("Facebook Page authorization failed", { ...details, connectionStatus })
            throw new RetryablePublicationError("Facebook Graph API request failed", details)
        }

        const id = payload?.[expectedIdField]
        if (typeof id !== "string" || !id) {
            throw new RetryablePublicationError("Facebook Graph API response did not contain an ID", {
                errorCode: "missing-facebook-id",
            })
        }
        return id
    }

    return {
        uploadUnpublishedPhoto: ({ pageId, imageUrl, accessToken }) =>
            request(`${encodeURIComponent(pageId)}/photos`, {
                url: imageUrl,
                published: "false",
                access_token: accessToken,
            }),

        createPagePost: ({ pageId, message, photoIds, accessToken }) =>
            request(`${encodeURIComponent(pageId)}/feed`, {
                message,
                attached_media: JSON.stringify(photoIds.map(media_fbid => ({ media_fbid }))),
                published: "true",
                access_token: accessToken,
            }),
    }
}
```

- [ ] **Step 4: Add an explicit abort test**

Add a test whose `fetchImpl` rejects with an error named `AbortError`, then assert `errorCode === "timeout"` and that the token is absent from the error message.

- [ ] **Step 5: Run and format the Graph client tests**

Run:

```bash
pnpm exec tsx workers/facebook-property-publication/facebook.client.spec.js
pnpm exec prettier --write workers/facebook-property-publication/facebook.client.js workers/facebook-property-publication/facebook.client.spec.js workers/facebook-property-publication/errors.js
```

Expected: all Graph client tests PASS.

- [ ] **Step 6: Stop at an uncommitted review checkpoint**

Inspect test-captured requests and confirm tokens exist only in request bodies, never errors or log-ready metadata.

---

### Task 7: Idempotent job processor and final guard

**Files:**

- Create: `workers/facebook-property-publication/processor.js`
- Create: `workers/facebook-property-publication/processor.spec.js`

**Interfaces:**

- Consumes: Task 3 decryptor/errors, Task 4 message/photo functions, Task 5 eligibility/repository, Task 6 Facebook client.
- Produces: `createFacebookPropertyProcessor(dependencies)`, a BullMQ-compatible async job function.
- Consumers: Task 8 runtime.

- [ ] **Step 1: Write the happy-path orchestration test**

```js
import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { createFacebookPropertyProcessor } from "./processor.js"

const future = new Date("2030-01-01T00:00:00.000Z")
const property = {
    id: "property-1",
    agencyId: "agency-1",
    status: "PUBLISHED",
    publishToFacebook: true,
    facebookPublishedAt: null,
    slug: "stan",
    name: { mk: "Стан" },
    description: { mk: "<p>Опис</p>" },
    photos: [
        { sizes: { large: "https://images.example/1.jpg" } },
        { sizes: { large: "https://images.example/2.jpg" } },
    ],
    listingType: "for_sale",
    price: 100000,
    hasApproximatePrice: false,
    approximatePrice: null,
    size: 80,
    district: "Центар",
    propertyLocation: { name: "Скопје" },
    agency: {
        facebookConnection: {
            id: "connection-1",
            revision: 1,
            status: "CONNECTED",
            pageId: "page-1",
            encryptedPageToken: "encrypted-token",
            pageTokenExpiresAt: future,
            dataAccessExpiresAt: future,
            grantedScopes: ["pages_manage_posts", "pages_read_engagement"],
            pageTasks: ["CREATE_CONTENT"],
        },
    },
}

const job = {
    id: "facebook-property-property-1",
    name: "publish-approved-property",
    data: { propertyId: "property-1", agencyId: "agency-1" },
    attemptsMade: 0,
}

describe("Facebook property processor", () => {
    test("uploads ordered photos, rechecks state, creates one post, then records publication", async () => {
        const events = []
        const repository = {
            loadProperty: async () => property,
            loadPublicationGuard: async () => property,
            recordPublished: async (_id, publishedAt) => (
                events.push(["record", publishedAt]),
                { outcome: "recorded" }
            ),
            invalidateConnection: async () => assert.fail("connection should remain valid"),
        }
        const facebookClient = {
            uploadUnpublishedPhoto: async ({ imageUrl }) => {
                events.push(["upload", imageUrl])
                return imageUrl.endsWith("1.jpg") ? "photo-1" : "photo-2"
            },
            createPagePost: async ({ photoIds }) => {
                events.push(["post", photoIds])
                return "page-1_post-1"
            },
        }
        const processor = createFacebookPropertyProcessor({
            repository,
            facebookClient,
            decryptToken: () => "page-token",
            tokenEncryptionKey: "unused-in-test",
            publicAppUrl: "https://imotko.mk",
            now: () => new Date("2026-07-22T12:00:00.000Z"),
            logger: { info: () => {}, error: () => {} },
        })

        assert.deepEqual(await processor(job), {
            published: true,
            propertyId: "property-1",
            facebookPostId: "page-1_post-1",
        })
        assert.deepEqual(
            events.map(event => event[0]),
            ["upload", "upload", "post", "record"]
        )
    })
})
```

- [ ] **Step 2: Add failure, skip, and race tests**

Add explicit tests asserting:

```js
// Existing facebookPublishedAt: returns { skipped: true, reason: "already-published", propertyId }
// and never calls decryptToken or facebookClient.

// Description HTML that converts to empty text: returns { skipped: true,
// reason: "invalid-facebook-content", propertyId } before decryptToken or facebookClient.

// First failed photo upload: rejects, never calls createPagePost, and never calls recordPublished.

// Final guard with publishToFacebook: false: uploads photos, returns reason "publication-guard-changed",
// never calls createPagePost, and never calls recordPublished.

// FacebookApiError with connectionStatus "EXPIRED": calls invalidateConnection with the original
// connection ID and revision, then rejects with BullMQ UnrecoverableError.

// recordPublished returns { outcome: "deleted" }: returns published success and emits a
// facebook_post_published event containing persistenceOutcome: "deleted" instead of retrying.

// Unknown job name or malformed identifier: rejects with BullMQ UnrecoverableError before database access.
```

Use fake dependencies with counters so every forbidden call is asserted as zero.

- [ ] **Step 3: Run processor tests and verify failure**

Run `pnpm exec tsx workers/facebook-property-publication/processor.spec.js`.

Expected: FAIL because `processor.js` does not exist.

- [ ] **Step 4: Implement the orchestration function**

```js
import { UnrecoverableError } from "bullmq"
import { MetaCryptoError, FacebookApiError } from "./errors.js"
import { evaluatePublicationEligibility, isPublicationGuardCurrent } from "./eligibility.js"
import { buildPropertyMessage, selectLargePhotoUrls } from "./message.js"

const validId = value => typeof value === "string" && value.trim()

export function createFacebookPropertyProcessor({
    repository,
    facebookClient,
    decryptToken,
    tokenEncryptionKey,
    publicAppUrl,
    logger,
    now = () => new Date(),
}) {
    const invalidateConnection = async (connection, status, errorCode, errorAt) => {
        await repository.invalidateConnection({
            connectionId: connection.id,
            revision: connection.revision,
            status,
            errorCode,
            errorAt,
        })
        logger.info("facebook_connection_invalidated", { connectionId: connection.id, status, errorCode })
    }

    return async job => {
        if (job.name !== "publish-approved-property")
            throw new UnrecoverableError("Unsupported Facebook publication job")

        const { propertyId, agencyId } = job.data || {}
        if (!validId(propertyId) || !validId(agencyId))
            throw new UnrecoverableError("Invalid Facebook publication job identifiers")

        logger.info("facebook_job_started", {
            jobId: job.id,
            jobName: job.name,
            propertyId,
            agencyId,
            attempt: job.attemptsMade + 1,
        })

        const property = await repository.loadProperty(propertyId)
        const checkedAt = now()
        const eligibility = evaluatePublicationEligibility(property, agencyId, checkedAt)
        if (!eligibility.eligible) {
            const connection = property?.agency?.facebookConnection
            if (eligibility.connectionStatus && connection) {
                await invalidateConnection(connection, eligibility.connectionStatus, eligibility.errorCode, checkedAt)
            }
            logger.info("facebook_job_skipped", { jobId: job.id, propertyId, agencyId, reason: eligibility.reason })
            return { skipped: true, reason: eligibility.reason, propertyId }
        }

        let message
        try {
            message = buildPropertyMessage(property, publicAppUrl)
        } catch {
            logger.info("facebook_job_skipped", {
                jobId: job.id,
                propertyId,
                agencyId,
                reason: "invalid-facebook-content",
            })
            return { skipped: true, reason: "invalid-facebook-content", propertyId }
        }

        const connection = property.agency.facebookConnection
        let accessToken
        try {
            accessToken = decryptToken(connection.encryptedPageToken, tokenEncryptionKey)
        } catch (error) {
            if (!(error instanceof MetaCryptoError)) throw error
            await invalidateConnection(connection, "ERROR", "token-decryption-failed", checkedAt)
            throw new UnrecoverableError("Stored Facebook Page token cannot be decrypted")
        }

        const photoIds = []
        try {
            for (const [index, imageUrl] of selectLargePhotoUrls(property.photos).entries()) {
                const photoId = await facebookClient.uploadUnpublishedPhoto({
                    pageId: connection.pageId,
                    imageUrl,
                    accessToken,
                })
                photoIds.push(photoId)
                logger.info("facebook_photo_uploaded", { jobId: job.id, propertyId, agencyId, photoIndex: index })
            }

            const guard = await repository.loadPublicationGuard(propertyId)
            if (!isPublicationGuardCurrent(connection, guard, agencyId, now())) {
                logger.info("facebook_job_skipped", {
                    jobId: job.id,
                    propertyId,
                    agencyId,
                    reason: "publication-guard-changed",
                })
                return { skipped: true, reason: "publication-guard-changed", propertyId }
            }

            const facebookPostId = await facebookClient.createPagePost({
                pageId: connection.pageId,
                message,
                photoIds,
                accessToken,
            })
            const publishedAt = now()
            const persistence = await repository.recordPublished(propertyId, publishedAt)
            if (persistence.outcome === "not-recorded")
                throw new Error("Facebook publication timestamp was not recorded")

            logger.info("facebook_post_published", {
                jobId: job.id,
                propertyId,
                agencyId,
                facebookPostId,
                persistenceOutcome: persistence.outcome,
            })
            return { published: true, propertyId, facebookPostId }
        } catch (error) {
            if (error instanceof FacebookApiError) {
                await invalidateConnection(connection, error.connectionStatus, error.errorCode, now())
                logger.error("facebook_job_failed", {
                    jobId: job.id,
                    jobName: job.name,
                    propertyId,
                    agencyId,
                    attempt: job.attemptsMade + 1,
                    errorCode: error.errorCode,
                    metaCode: error.metaCode,
                    metaSubcode: error.metaSubcode,
                    fbtraceId: error.fbtraceId,
                })
                throw new UnrecoverableError("Facebook Page authorization no longer permits publishing")
            }
            throw error
        } finally {
            accessToken = null
        }
    }
}
```

- [ ] **Step 5: Run all processor tests**

Run `pnpm exec tsx workers/facebook-property-publication/processor.spec.js`.

Expected: happy, permanent skip, photo failure, final-guard race, connection invalidation, deleted-row, and invalid-job tests all PASS.

- [ ] **Step 6: Stop at an uncommitted review checkpoint**

Trace the test events and confirm the only visible post call occurs after all photo uploads and the second database guard.

---

### Task 8: Structured logging, BullMQ runtime, and graceful shutdown

**Files:**

- Create: `workers/facebook-property-publication/logger.js`
- Create: `workers/facebook-property-publication/logger.spec.js`
- Create: `workers/facebook-property-publication/runtime.js`
- Create: `workers/facebook-property-publication/runtime.spec.js`
- Create: `workers/facebook-property-publication/index.js`

**Interfaces:**

- Produces: `createLogger(output)`, `startFacebookWorker(dependencies)`, and the `pnpm worker:facebook` executable entrypoint.
- Consumes: all prior task interfaces and the shared `#database/client.js` singleton.

- [ ] **Step 1: Write logger redaction tests**

```js
import assert from "node:assert/strict"
import { test } from "node:test"
import { createLogger } from "./logger.js"

test("logger emits only explicitly allowed structured fields", () => {
    const lines = []
    const logger = createLogger({ log: line => lines.push(line), error: line => lines.push(line) })
    logger.info("facebook_job_started", {
        jobId: "job-1",
        propertyId: "property-1",
        accessToken: "must-not-appear",
        description: "must-not-appear",
        imageUrl: "must-not-appear",
    })
    const parsed = JSON.parse(lines[0])
    assert.equal(parsed.event, "facebook_job_started")
    assert.equal(parsed.jobId, "job-1")
    assert.equal(parsed.propertyId, "property-1")
    assert.equal(JSON.stringify(parsed).includes("must-not-appear"), false)
})
```

- [ ] **Step 2: Implement an allowlist-based JSON logger**

```js
const ALLOWED_FIELDS = new Set([
    "jobId",
    "jobName",
    "propertyId",
    "agencyId",
    "connectionId",
    "attempt",
    "photoIndex",
    "durationMs",
    "reason",
    "status",
    "errorCode",
    "metaCode",
    "metaSubcode",
    "fbtraceId",
    "facebookPostId",
    "persistenceOutcome",
])

const sanitize = fields =>
    Object.fromEntries(Object.entries(fields || {}).filter(([key, value]) => ALLOWED_FIELDS.has(key) && value != null))

export function createLogger(output = console) {
    const write = (method, event, fields) =>
        output[method](
            JSON.stringify({
                timestamp: new Date().toISOString(),
                level: method === "error" ? "error" : "info",
                event,
                ...sanitize(fields),
            })
        )
    return {
        info: (event, fields = {}) => write("log", event, fields),
        error: (event, fields = {}) => write("error", event, fields),
    }
}
```

- [ ] **Step 3: Write a lifecycle test with fake BullMQ and Redis objects**

The test must assert:

```js
// startFacebookWorker constructs Worker with:
// queue name "facebook-property-publication"
// concurrency 1
// the injected Redis connection
// the injected processor

// shutdown calls worker.close(), redis.quit(), and prisma.$disconnect() exactly once in that order.
// a second shutdown call is a no-op.
// worker "failed" events log job identifiers and sanitized error metadata.
```

Use a fake worker with `on`, `waitUntilReady`, and `close` methods and a captured constructor argument list.

- [ ] **Step 4: Implement the testable runtime**

```js
export async function startFacebookWorker({ WorkerClass, connection, processor, prisma, logger }) {
    const worker = new WorkerClass("facebook-property-publication", processor, {
        connection,
        concurrency: 1,
    })

    worker.on("completed", job => {
        logger.info("facebook_job_completed", { jobId: job.id, jobName: job.name })
    })
    worker.on("failed", (job, error) => {
        logger.error("facebook_job_failed", {
            jobId: job?.id,
            jobName: job?.name,
            propertyId: job?.data?.propertyId,
            agencyId: job?.data?.agencyId,
            attempt: job ? job.attemptsMade + 1 : null,
            errorCode: error?.errorCode || error?.name || "unknown",
            metaCode: error?.metaCode,
            metaSubcode: error?.metaSubcode,
            fbtraceId: error?.fbtraceId,
        })
    })
    worker.on("error", error => {
        logger.error("facebook_worker_error", { errorCode: error?.name || "unknown" })
    })

    await worker.waitUntilReady()
    logger.info("facebook_worker_started")

    let stopped = false
    return {
        worker,
        async shutdown() {
            if (stopped) return
            stopped = true
            logger.info("facebook_worker_stopping")
            let firstError
            for (const close of [() => worker.close(), () => connection.quit(), () => prisma.$disconnect()]) {
                try {
                    await close()
                } catch (error) {
                    firstError ||= error
                }
            }
            logger.info("facebook_worker_stopped")
            if (firstError) throw firstError
        },
    }
}
```

Add `facebook_job_completed`, `facebook_worker_error`, and their fields to the logger event/field expectations without expanding the field allowlist to secrets.

- [ ] **Step 5: Wire the production entrypoint**

```js
import "dotenv/config"
import { Worker } from "bullmq"
import IORedis from "ioredis"
import prisma from "#database/client.js"
import { loadFacebookWorkerConfig } from "./config.js"
import { decryptMetaToken } from "./crypto.js"
import { createFacebookClient } from "./facebook.client.js"
import { createLogger } from "./logger.js"
import { createFacebookPropertyProcessor } from "./processor.js"
import { createPropertyRepository } from "./property.repository.js"
import { startFacebookWorker } from "./runtime.js"

const logger = createLogger()

async function main() {
    let config
    try {
        config = loadFacebookWorkerConfig()
    } catch (error) {
        logger.error("facebook_worker_start_failed", {
            errorCode: "invalid-configuration",
            reason: error.message,
        })
        process.exitCode = 1
        return
    }

    let connection
    try {
        connection = new IORedis(config.redisUrl, {
            maxRetriesPerRequest: null,
            tls: {},
        })
        connection.on("error", error => {
            logger.error("facebook_redis_error", { errorCode: error?.name || "unknown" })
        })

        const repository = createPropertyRepository(prisma)
        const facebookClient = createFacebookClient({
            graphApiVersion: config.graphApiVersion,
            timeoutMs: config.requestTimeoutMs,
        })
        const processor = createFacebookPropertyProcessor({
            repository,
            facebookClient,
            decryptToken: decryptMetaToken,
            tokenEncryptionKey: config.tokenEncryptionKey,
            publicAppUrl: config.publicAppUrl,
            logger,
        })
        const runtime = await startFacebookWorker({
            WorkerClass: Worker,
            connection,
            processor,
            prisma,
            logger,
        })

        let shutdownPromise
        const shutdown = () => {
            shutdownPromise ||= runtime.shutdown().catch(error => {
                logger.error("facebook_worker_shutdown_failed", { errorCode: error?.name || "unknown" })
                process.exitCode = 1
            })
            return shutdownPromise
        }
        process.once("SIGTERM", shutdown)
        process.once("SIGINT", shutdown)
    } catch (error) {
        logger.error("facebook_worker_start_failed", { errorCode: error?.name || "unknown" })
        if (connection) await connection.quit().catch(() => {})
        await prisma.$disconnect().catch(() => {})
        process.exitCode = 1
    }
}

await main()
```

- [ ] **Step 6: Run logger and runtime tests**

Run:

```bash
pnpm exec tsx workers/facebook-property-publication/logger.spec.js
pnpm exec tsx workers/facebook-property-publication/runtime.spec.js
```

Expected: redaction, constructor options, error-event logging, idempotent shutdown, and shutdown ordering tests PASS.

- [ ] **Step 7: Test startup validation without connecting externally**

Run with a deliberately missing configuration variable:

```bash
META_GRAPH_API_VERSION= pnpm worker:facebook
```

Expected: immediate non-zero exit naming `META_GRAPH_API_VERSION`, with no Redis or Prisma connection attempt and no secret output.

- [ ] **Step 8: Stop at an uncommitted review checkpoint**

Confirm `index.js` is the only side-effectful module; importing every other module in tests must not open Redis, Prisma, or Meta connections.

---

### Task 9: Full verification and Railway runbook

**Files:**

- Create: `workers/facebook-property-publication/README.md`
- Modify as fixes require: worker files and adjacent specs only

**Interfaces:**

- Produces: verified worker artifact and exact Railway/test-mode operating instructions.

- [ ] **Step 1: Write the runbook**

The README must contain these concrete sections:

```markdown
# Facebook Property Publication Worker

## Start command

`pnpm worker:facebook`

## Required variables

`DATABASE_URL`, `UPSTASH_REDIS_URL`, `META_TOKEN_ENCRYPTION_KEY`,
`META_GRAPH_API_VERSION`, and `PUBLIC_APP_URL`.

## Railway

Use the same repository as Express, one replica, the custom start command above,
automatic restart, and no public domain.

## Test-mode safety

Until Meta production review is complete, the Next.js producer must enqueue only
explicitly allowlisted test agencies. A worker-side allowlist is not safe on the shared queue.

## Operational outcomes

Document each structured event, permanent skip reason, retryable failure category,
connection invalidation state, and the five-attempt retained-failure behavior.

## Upstash usage

Explain that a continuously running BullMQ worker generates Redis activity while idle,
that command usage must be monitored, and that a fixed Upstash plan may be appropriate.

## Production readiness

Require Meta App Review for `pages_manage_posts` and `pages_read_engagement`, Live mode,
production credentials, Page reconnection/validation, and one controlled production post
before enabling real agencies.

## Accepted limitations

Document queue-enqueue recovery as manual, timestamp-only duplicate windows, orphaned
unpublished photo objects after failed attempts, and no edit/unpublish synchronization.
```

- [ ] **Step 2: Run the complete automated worker suite**

Run:

```bash
pnpm test:facebook-worker
```

Expected: all worker spec files PASS with zero real Redis, PostgreSQL, or Meta calls.

- [ ] **Step 3: Run repository-level validation**

Run:

```bash
pnpm exec prettier --check package.json .env.example prisma/schema/property.prisma workers/facebook-property-publication docs/superpowers
pnpm prisma validate
pnpm prisma generate
git diff --check
```

Expected: formatting, schema validation, client generation, and whitespace checks all succeed.

- [ ] **Step 4: Inspect the final change scope**

Run:

```bash
git status --short
git diff -- package.json pnpm-lock.yaml .env.example prisma/schema/property.prisma workers/facebook-property-publication docs/superpowers
git diff --cached --stat
```

Expected: worker implementation changes are unstaged; pre-existing user changes remain preserved; no unrelated file is modified; the cached diff is unchanged from before implementation.

- [ ] **Step 5: Perform a local queue-to-processor smoke test**

With the local/shared test environment loaded, run:

```bash
pnpm worker:facebook
```

Expected first structured event: `facebook_worker_started`.

From the Next.js test producer, enqueue exactly one eligible property for an allowlisted Meta test agency. Confirm:

1. The job starts once.
2. Between one and ten `facebook_photo_uploaded` events appear in stored order.
3. One `facebook_post_published` event contains the property ID and returned Facebook post ID.
4. The Page shows one visible post with the approved Macedonian structure and Imotko URL.
5. PostgreSQL `Property.facebookPublishedAt` is non-null.

- [ ] **Step 6: Verify duplicate prevention**

Retry the completed job through BullMQ tooling or enqueue it again after removing the retained job in the test environment.

Expected: `facebook_job_skipped` with reason `already-published`; no photo or feed request is made.

- [ ] **Step 7: Verify one controlled transient failure**

Use a test double or temporarily configured unreachable Graph base only in a local test harness; do not change the production endpoint in committed source.

Expected: the job becomes retryable, `attempt` increases up to the configured maximum, and the final failed job remains retained. No token, description, or image URL appears in logs.

- [ ] **Step 8: Verify one controlled permission failure**

Use a disposable Meta test Page connection with an invalidated test token.

Expected: the current connection revision changes to `EXPIRED`, `REVOKED`, or `ERROR` as classified; `lastErrorCode` and `lastErrorAt` are set; the job stops without using all five attempts.

- [ ] **Step 9: Configure the Railway worker service**

In Railway:

1. Add a second service from the same repository.
2. Set custom start command `pnpm worker:facebook`.
3. Set replicas to `1`.
4. Do not generate a public domain.
5. Enable automatic restart.
6. Configure the five required variables and shared database-pool settings.
7. Do not provide Upstash REST or Meta OAuth app credentials to this service.
8. Deploy and wait for `facebook_worker_started` before enabling the test producer.

- [ ] **Step 10: Stop at the final uncommitted review checkpoint**

Run `git status --short` and confirm explicitly that nothing is staged or committed. Report automated test results, Prisma validation/generation results, the manual Facebook test property ID, the observed post ID, retry-path evidence, and any remaining rollout dependency such as Meta App Review.

---

## Implementation completion criteria

- All nine tasks have their focused tests passing.
- `pnpm test:facebook-worker`, Prettier check, Prisma validation, Prisma generation, and `git diff --check` succeed.
- The corrective local migration is applied and `facebookPublishedAt` is `timestamp with time zone`.
- One allowlisted Meta test property is published with ordered images and the exact structured Macedonian message.
- A repeat job skips because `facebookPublishedAt` is present.
- A transient failure retries and remains inspectable after exhaustion.
- A permanent token/permission failure revision-safely updates `AgencyFacebookConnection` and stops retries.
- Railway runs one portless worker replica using `pnpm worker:facebook`.
- No tokens, encrypted envelopes, descriptions, or image URLs appear in logs.
- No repository file is staged or committed.
