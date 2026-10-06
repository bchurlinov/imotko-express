# Short-Term Rent — Express Implementation Plan (Sub-project A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Repository rule (overrides every skill):** never run `git commit`, `git push`, `git merge`, or open a PR. Each task
> ends with a **Stage** step (`git add …`) only. Subagents must be told this explicitly.

**Repo:** `imotko-express` (`/Users/bojanchurlinov/Personal/imotko-express`). Every path below is relative to it
unless it starts with `imotko/`.

**Goal:** Let Express serve short-term rent listings to agency websites (and, from sub-project D, to app 1.1.0) while
every app version in the stores today (1.0.5 and older) keeps getting exactly the data it got before.

**Architecture:** A middleware reads `X-Imotko-Client` / `X-Imotko-App-Version` and sets `req.capabilities`
(`{ shortTermRent: boolean }`) from a per-feature map of minimum app versions (all unset → off for every app) and a
`TEMPLATES_FEATURES` map. One property visibility helper turns capabilities into Prisma conditions; search,
promoted listings, details, favorites and chat use it. Saved searches and chat threads that point at a hidden
listing are filtered or stripped. Services take `capabilities` as an explicit argument whose default is the
legacy-safe one, so jobs and admin code that call them without it never leak new data.

**Tech Stack:** Express 5, Prisma 7 (pg adapter, client in `generated/prisma`), Node's built-in test runner via
`npx tsx --test`, ESM with `#` import aliases.

**Spec:** `docs/marketplace-rollout/02_a_design_short_term_rent.md` §11 (in the `imotko` repo). Roadmap rules:
`docs/marketplace-rollout/00_roadmap.md` §2 and §4.

**Companion plans:** `05_a_plan_web.md` (creates the migration this plan copies), `07_a_plan_templates.md` (sends the
`templates` header this plan reads).

**Deviations from the spec (deliberate, small):**
- **"404" for a hidden listing by id is `200 { data: null }`.** `GET /api/v1/properties/:id` already answers a missing
  id and a hidden agency's listing with `200 { data: null }`, which app 1.0.5 shows as its "not found" screen. A
  hidden short-term listing gets exactly the same answer, so the app cannot tell the difference. Favorites-add and
  chat-start keep their existing 404 errors.
- **Minimum versions come from a function**, `getFeatureMinAppVersions(env = process.env)`, instead of a constant
  read at import time, so specs can pass their own environment. Same environment variables, same behaviour.
- **Saved searches use a positive JSON match, then `id: { notIn }`.** The spec's
  `NOT: { filters: { path: ["listingType"], equals: "short_term_rent" } }` would also drop every search whose
  `filters` has no `listingType` key (the path is SQL `NULL`, and `NOT NULL` is not true), i.e. most searches created
  from the app.
- **Analytics:** an explicit `listingType` outside sale / long-term rent answers `400`; without `listingType` the two
  price queries add `IN ('for_sale', 'for_rent')`. Demand analytics (views, not prices, and no `listingType` from its
  controller) is unchanged.
- **Admin chat thread view** gets every capability (`ALL_CAPABILITIES`), so moderators always see the listing.

## Global Constraints

- JavaScript only, ESM, `#` import aliases from `package.json` (`#config/*`, `#services/*`, `#middlewares/*`,
  `#generated/*`, `#database/*`).
- Prettier: no semicolons, 4-space indent, double quotes, 120 columns, `arrowParens: "avoid"`, trailing commas es5.
- Enums from `#generated/prisma/enums.ts` (`PropertyListingType.short_term_rent` exists after Task 1).
- Headers: `X-Imotko-Client: templates` (agency websites), `X-Imotko-Client: mobile` + `X-Imotko-App-Version: x.y.z`
  (app from 1.1.0). No header → legacy for everything.
- `MOBILE_MIN_VERSION_SHORT_TERM_RENT` stays **unset** in every environment until sub-project D.
- Versions compare numerically per segment (`1.0.10` > `1.0.9`); anything that is not `x`, `x.y` or `x.y.z` digits is
  unparsable → feature off.
- Services take `capabilities` as an argument defaulting to `LEGACY_CAPABILITIES`.
- Express never runs migrations; it only copies schema + migration folder and runs `npx prisma generate`.
- Tests: `node:test` + `node:assert/strict`, prisma methods monkey-patched and restored in `afterEach`, exactly like
  `src/api/v1/services/properties/properties.service.spec.js`. Run with `npx tsx --test <file>`.
- Never commit. Stage only.

## Review Focus

1. **App 1.0.5 sends no headers at all** — every route it calls must behave as before for legacy callers; the
   capabilities default must be "all off", including for code paths that never receive `req.capabilities` (jobs,
   admin, other services) — pinned in Task 2 (resolver) and every service spec using the default argument.
2. **A legacy caller asking for `listingType=short_term_rent` explicitly** (hand-crafted URL, cached deep link) must get
   an empty page, not short-term rows — pinned in Task 3.
3. **Promoted listings bypass the normal where** — the promoted query is built separately and must carry the same
   short-term exclusion — pinned in Task 3.
4. **Saved searches without a `listingType` key** (created from the app) must still be listed for legacy callers —
   pinned in Task 5.
5. **A thread started on the web about a short-term listing** must still open in app 1.0.5 with all messages, just
   without the listing card and without a `propertyId` the app could open — pinned in Task 6.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `prisma/schema/property.prisma`, `prisma/migrations/<ts>_short_term_rent/` | Copied from `imotko` (Task 1) |
| `src/config/client_capabilities.js` (new) | Feature map, `TEMPLATES_FEATURES`, `LEGACY_CAPABILITIES`, `ALL_CAPABILITIES` |
| `src/api/v1/middlewares/client_capabilities.js` (new) | Version parsing, `resolveClientCapabilities`, `attachClientCapabilities` |
| `src/api/v1/routes/index.js` | Mounts the middleware for every `/api/v1` route |
| `src/api/v1/services/properties/utils/visibility.js` (new) | `hiddenPropertyConditions`, `isPropertyVisibleTo` — the one place B extends |
| `src/api/v1/services/properties/properties.service.js` | Gate in search (normal + promoted) and detail; `guests` filter |
| `src/api/v1/services/users/users_properties_favorites.service.js` | Gate in favorites list and add |
| `src/api/v1/services/users/users_searches.service.js` | Hide short-term saved searches |
| `src/api/v1/services/chat/chat_visibility.js` (new) | `withoutHiddenProperty` |
| `src/api/v1/services/chat/conversation.service.js`, `chat_inbox.service.js` | Chat start gate; inbox/thread strip |
| `src/api/v1/services/analytics/analytics.service.js` | Price statistics listing-type allow-list |
| Controllers: properties, website, users, users_search, chat, chat_admin, analytics | Pass `req.capabilities` |
| `.env.example` | Documents `MOBILE_MIN_VERSION_SHORT_TERM_RENT` (unset) |

---

### Task 1: Schema sync

**Files:**
- Modify: `prisma/schema/property.prisma` (copied)
- Create: `prisma/migrations/<timestamp>_short_term_rent/migration.sql` (copied)

**Interfaces:**
- Consumes: `imotko` web plan Task 1 (the schema change and the migration folder exist in `imotko`).
- Produces: `PropertyListingType.short_term_rent`, `PropertyPriceUnit`, `Property.priceUnit`, `maxGuests`,
  `minNights`, `checkInFrom`, `checkOutUntil` in `#generated/prisma/*`.

- [ ] **Step 1: Copy the schema file and the migration folder**

```bash
cp ../imotko/prisma/schema/property.prisma prisma/schema/property.prisma
cp -R ../imotko/prisma/migrations/*_short_term_rent prisma/migrations/
```

- [ ] **Step 2: Verify both repos now match**

Run: `diff -rq ../imotko/prisma/schema prisma/schema && diff <(ls ../imotko/prisma/migrations) <(ls prisma/migrations)`
Expected: no output.

- [ ] **Step 3: Regenerate the client**

Run: `npx prisma generate && rg -n "short_term_rent|PER_NIGHT" generated/prisma/enums.ts`
Expected: both values are listed. Do **not** run `prisma migrate` here.

- [ ] **Step 4: Run the existing specs**

Run: `npx tsx --test src/api/v1/services/properties/properties.service.spec.js src/api/v1/services/chat/*.spec.js`
Expected: PASS (nothing changed in behaviour).

- [ ] **Step 5: Stage**

```bash
git add prisma/schema/property.prisma prisma/migrations
```

---

### Task 2: Client capabilities

**Files:**
- Create: `src/config/client_capabilities.js`
- Create: `src/api/v1/middlewares/client_capabilities.js`
- Test: `src/api/v1/middlewares/client_capabilities.spec.js`
- Modify: `src/api/v1/routes/index.js`
- Modify: `.env.example`

**Interfaces:**
- Produces:
  - `getFeatureMinAppVersions(env = process.env): { shortTermRent: string | null }`
  - `TEMPLATES_FEATURES: { shortTermRent: true }`
  - `LEGACY_CAPABILITIES: { shortTermRent: false }` (frozen; keys follow `getFeatureMinAppVersions`)
  - `ALL_CAPABILITIES: { shortTermRent: true }` (frozen)
  - `parseAppVersion(value): [number, number, number] | null`
  - `isVersionAtLeast(version, minimum): boolean`
  - `resolveClientCapabilities({ client, appVersion }, env = process.env): { shortTermRent: boolean }`
  - `attachClientCapabilities(req, res, next)` → sets `req.capabilities`

- [ ] **Step 1: Write the failing spec**

`src/api/v1/middlewares/client_capabilities.spec.js`:

```js
import assert from "node:assert/strict"
import test from "node:test"
import { LEGACY_CAPABILITIES } from "#config/client_capabilities.js"
import {
    attachClientCapabilities,
    isVersionAtLeast,
    parseAppVersion,
    resolveClientCapabilities,
} from "./client_capabilities.js"

const ENV_UNSET = {}
const ENV_1_1_0 = { MOBILE_MIN_VERSION_SHORT_TERM_RENT: "1.1.0" }

test("callers without a header are legacy for every feature", () => {
    assert.deepEqual(resolveClientCapabilities({}, ENV_1_1_0), { shortTermRent: false })
    assert.deepEqual(LEGACY_CAPABILITIES, { shortTermRent: false })
})

test("agency websites get the templates features", () => {
    assert.deepEqual(resolveClientCapabilities({ client: "templates" }, ENV_UNSET), { shortTermRent: true })
    assert.deepEqual(resolveClientCapabilities({ client: " Templates " }, ENV_UNSET), { shortTermRent: true })
})

test("the app gets nothing while the minimum version is unset", () => {
    assert.deepEqual(resolveClientCapabilities({ client: "mobile", appVersion: "9.9.9" }, ENV_UNSET), {
        shortTermRent: false,
    })
})

test("the app gets a feature from its minimum version on", () => {
    const resolve = appVersion => resolveClientCapabilities({ client: "mobile", appVersion }, ENV_1_1_0).shortTermRent
    assert.equal(resolve("1.0.5"), false)
    assert.equal(resolve("1.1.0"), true)
    assert.equal(resolve("1.10.0"), true)
    assert.equal(resolve("2"), true)
    assert.equal(resolve(undefined), false)
    assert.equal(resolve("1.1.0-beta"), false)
    assert.equal(resolve("garbage"), false)
})

test("unknown clients are legacy", () => {
    assert.deepEqual(resolveClientCapabilities({ client: "curl", appVersion: "5.0.0" }, ENV_1_1_0), {
        shortTermRent: false,
    })
})

test("versions compare numerically per segment", () => {
    assert.deepEqual(parseAppVersion("1.2"), [1, 2, 0])
    assert.equal(parseAppVersion("1.2.3.4"), null)
    assert.equal(isVersionAtLeast("1.0.10", "1.0.9"), true)
    assert.equal(isVersionAtLeast("1.0.9", "1.0.10"), false)
    assert.equal(isVersionAtLeast("1.1.0", "1.1.0"), true)
    assert.equal(isVersionAtLeast("1.1.0", null), false)
})

test("the middleware reads both headers", () => {
    const headers = { "x-imotko-client": "templates" }
    const req = { get: name => headers[name.toLowerCase()] }
    let nextCalled = false
    attachClientCapabilities(req, {}, () => {
        nextCalled = true
    })
    assert.equal(nextCalled, true)
    assert.deepEqual(req.capabilities, { shortTermRent: true })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx --test src/api/v1/middlewares/client_capabilities.spec.js`
Expected: FAIL — cannot find module `#config/client_capabilities.js`.

- [ ] **Step 3: Create the config**

`src/config/client_capabilities.js`:

```js
/**
 * Client capability configuration (roadmap rules 2–4)
 * @module config/client_capabilities
 */

/**
 * Minimum app version per feature. Read on every call so specs can pass their own environment.
 * Unset → null → the feature is off for every app. All stay unset until the app 1.1.0 release (sub-project D).
 * @param {NodeJS.ProcessEnv} [env] - Environment to read from
 * @returns {{ shortTermRent: string | null }}
 */
export const getFeatureMinAppVersions = (env = process.env) => ({
    shortTermRent: env.MOBILE_MIN_VERSION_SHORT_TERM_RENT || null,
})

/** Agency websites are deployed by us (no version), so they adopt a feature as soon as web and Express support it. */
export const TEMPLATES_FEATURES = Object.freeze({ shortTermRent: true })

const FEATURES = Object.keys(getFeatureMinAppVersions({}))

/** Apps 1.0.5 and older, unknown callers, jobs and admin code that do not pass capabilities. */
export const LEGACY_CAPABILITIES = Object.freeze(Object.fromEntries(FEATURES.map(feature => [feature, false])))

/** Internal callers that must see everything (admin moderation). */
export const ALL_CAPABILITIES = Object.freeze(Object.fromEntries(FEATURES.map(feature => [feature, true])))
```

- [ ] **Step 4: Create the middleware**

`src/api/v1/middlewares/client_capabilities.js`:

```js
import { getFeatureMinAppVersions, LEGACY_CAPABILITIES, TEMPLATES_FEATURES } from "#config/client_capabilities.js"

const VERSION_PATTERN = /^\d+(\.\d+){0,2}$/

/**
 * "1.10" → [1, 10, 0]; anything that is not 1–3 dot-separated numbers → null
 * @param {unknown} value - Raw header value
 * @returns {number[] | null}
 */
export const parseAppVersion = value => {
    const version = typeof value === "string" ? value.trim() : ""
    if (!VERSION_PATTERN.test(version)) return null
    const parts = version.split(".").map(Number)
    while (parts.length < 3) parts.push(0)
    return parts
}

/**
 * Numeric comparison per segment, so 1.0.10 > 1.0.9
 * @param {unknown} version - App version
 * @param {unknown} minimum - Required minimum
 * @returns {boolean}
 */
export const isVersionAtLeast = (version, minimum) => {
    const current = parseAppVersion(version)
    const required = parseAppVersion(minimum)
    if (!current || !required) return false
    for (let index = 0; index < 3; index += 1) {
        if (current[index] !== required[index]) return current[index] > required[index]
    }
    return true
}

/**
 * Works out what a caller may see. No header, an unknown client, or an unparsable version → legacy.
 * @param {{ client?: string, appVersion?: string }} caller - Header values
 * @param {NodeJS.ProcessEnv} [env] - Environment to read the minimum versions from
 * @returns {{ shortTermRent: boolean }}
 */
export const resolveClientCapabilities = ({ client, appVersion } = {}, env = process.env) => {
    const caller = typeof client === "string" ? client.trim().toLowerCase() : ""
    const features = Object.keys(LEGACY_CAPABILITIES)

    if (caller === "templates") {
        return Object.fromEntries(features.map(feature => [feature, TEMPLATES_FEATURES[feature] === true]))
    }

    if (caller === "mobile") {
        const minVersions = getFeatureMinAppVersions(env)
        return Object.fromEntries(
            features.map(feature => [
                feature,
                Boolean(minVersions[feature]) && isVersionAtLeast(appVersion, minVersions[feature]),
            ])
        )
    }

    return { ...LEGACY_CAPABILITIES }
}

/**
 * Sets req.capabilities for every /api/v1 request
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 */
export const attachClientCapabilities = (req, res, next) => {
    req.capabilities = resolveClientCapabilities({
        client: req.get("X-Imotko-Client"),
        appVersion: req.get("X-Imotko-App-Version"),
    })
    next()
}
```

- [ ] **Step 5: Run the spec to verify it passes**

Run: `npx tsx --test src/api/v1/middlewares/client_capabilities.spec.js`
Expected: PASS (7 tests).

- [ ] **Step 6: Mount the middleware for every `/api/v1` route**

In `src/api/v1/routes/index.js`, add the import:

```js
import { attachClientCapabilities } from "#middlewares/client_capabilities.js"
```

and make it the first line inside the exported function:

```js
export default app => {
    app.use("/api/v1", attachClientCapabilities)
    app.use("/api/v1/properties", propertiesRouter)
    // ...the other routers unchanged
```

(Agency websites call Express from the server (`"use server"` in `imotko-templates`) and the app is native, so the
new headers need no CORS change.)

- [ ] **Step 7: Document the variable**

Append to `.env.example`:

```bash
# Minimum app version that sees short-term rent listings (sub-project D sets it to 1.1.0). Unset = off for every app.
# MOBILE_MIN_VERSION_SHORT_TERM_RENT=
```

- [ ] **Step 8: Stage**

```bash
git add src/config/client_capabilities.js src/api/v1/middlewares/client_capabilities.js src/api/v1/middlewares/client_capabilities.spec.js src/api/v1/routes/index.js .env.example
```

---

### Task 3: Property visibility — search, promoted, details, guests filter

**Files:**
- Create: `src/api/v1/services/properties/utils/visibility.js`
- Modify: `src/api/v1/services/properties/properties.service.js`
- Modify: `src/api/v1/controllers/properties/properties.controller.js`
- Modify: `src/api/v1/controllers/website/website.controller.js`
- Test: `src/api/v1/services/properties/utils/visibility.spec.js` (new), `src/api/v1/services/properties/properties.service.spec.js` (extend)

**Interfaces:**
- Consumes: `LEGACY_CAPABILITIES` (Task 2), `PropertyListingType` (Task 1).
- Produces:
  - `hiddenPropertyConditions(capabilities = LEGACY_CAPABILITIES): PropertyWhereInput[]` — `[]` when nothing is hidden
  - `isPropertyVisibleTo(property, capabilities = LEGACY_CAPABILITIES): boolean` — `property` needs `listingType`
  - `getPropertiesService(params, { includeHiddenAgencies, promoteFeatured, capabilities })`
  - `getPropertyService(propertyId, viewContext, { includeHiddenAgencies, capabilities })`
  - Query param `guests` → `maxGuests >= guests`

- [ ] **Step 1: Write the failing visibility spec**

`src/api/v1/services/properties/utils/visibility.spec.js`:

```js
import assert from "node:assert/strict"
import test from "node:test"
import { hiddenPropertyConditions, isPropertyVisibleTo } from "./visibility.js"

test("legacy callers never see short-term rent", () => {
    assert.deepEqual(hiddenPropertyConditions(), [{ listingType: { not: "short_term_rent" } }])
    assert.equal(isPropertyVisibleTo({ listingType: "short_term_rent" }), false)
    assert.equal(isPropertyVisibleTo({ listingType: "for_sale" }), true)
})

test("callers with the capability see everything", () => {
    assert.deepEqual(hiddenPropertyConditions({ shortTermRent: true }), [])
    assert.equal(isPropertyVisibleTo({ listingType: "short_term_rent" }, { shortTermRent: true }), true)
})

test("a missing property is never visible", () => {
    assert.equal(isPropertyVisibleTo(null, { shortTermRent: true }), false)
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx --test src/api/v1/services/properties/utils/visibility.spec.js`
Expected: FAIL — cannot find module `./visibility.js`.

- [ ] **Step 3: Create the helper**

`src/api/v1/services/properties/utils/visibility.js`:

```js
import { PropertyListingType } from "#generated/prisma/enums.ts"
import { LEGACY_CAPABILITIES } from "#config/client_capabilities.js"

/**
 * Prisma conditions that hide listings a caller cannot handle. Every property gate (search, promoted, detail,
 * favorites, chat) goes through here, so a new kind of listing is hidden in one place.
 * @param {{ shortTermRent?: boolean }} [capabilities] - req.capabilities
 * @returns {import('#generated/prisma/client.ts').Prisma.PropertyWhereInput[]}
 */
export const hiddenPropertyConditions = (capabilities = LEGACY_CAPABILITIES) => [
    ...(capabilities.shortTermRent ? [] : [{ listingType: { not: PropertyListingType.short_term_rent } }]),
]

/**
 * Same rule for a single loaded row
 * @param {{ listingType?: string } | null | undefined} property - Property with at least listingType
 * @param {{ shortTermRent?: boolean }} [capabilities] - req.capabilities
 * @returns {boolean}
 */
export const isPropertyVisibleTo = (property, capabilities = LEGACY_CAPABILITIES) =>
    Boolean(property) && (capabilities.shortTermRent || property.listingType !== PropertyListingType.short_term_rent)
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx tsx --test src/api/v1/services/properties/utils/visibility.spec.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing service tests**

Append to `src/api/v1/services/properties/properties.service.spec.js` (add `getPropertyService` to the existing
import from `./properties.service.js`, and save/restore `prisma.property.findUnique` and
`prisma.propertyView.create` in the existing `afterEach` the same way the other originals are restored):

```js
const hasExclusion = where => (where.AND || []).some(condition => condition.listingType?.not === "short_term_rent")

test("legacy search and promoted queries leave out short-term rent", async () => {
    const countQueries = []
    const findManyQueries = []
    prisma.property.count = async query => {
        countQueries.push(query)
        return 0
    }
    prisma.property.findMany = async query => {
        findManyQueries.push(query)
        return []
    }

    await getPropertiesService({ page: "1" })

    assert.ok(countQueries.every(query => hasExclusion(query.where)))
    const promotedIdQuery = findManyQueries.find(query => query.select?.id)
    assert.ok(hasExclusion(promotedIdQuery.where))
})

test("an explicit short-term search from a legacy caller cannot match anything", async () => {
    const countQueries = []
    prisma.property.count = async query => {
        countQueries.push(query)
        return 0
    }
    prisma.property.findMany = async () => []

    await getPropertiesService({ listingType: "short_term_rent", page: "1" })

    const where = countQueries[0].where
    assert.equal(where.listingType, "short_term_rent")
    assert.ok(where.AND.some(condition => condition.listingType?.not === "short_term_rent"))
})

test("callers with the capability are not filtered, and guests filters maxGuests", async () => {
    const countQueries = []
    prisma.property.count = async query => {
        countQueries.push(query)
        return 0
    }
    prisma.property.findMany = async () => []

    await getPropertiesService({ guests: "4", page: "1" }, { capabilities: { shortTermRent: true } })

    assert.ok(countQueries.every(query => !hasExclusion(query.where)))
    assert.deepEqual(countQueries[0].where.maxGuests, { gte: 4 })
})

test("junk guests values are ignored", async () => {
    const countQueries = []
    prisma.property.count = async query => {
        countQueries.push(query)
        return 0
    }
    prisma.property.findMany = async () => []

    await getPropertiesService({ guests: "abc", page: "1" })
    await getPropertiesService({ guests: "0", page: "1" })

    assert.ok(countQueries.every(query => query.where.maxGuests === undefined))
})

test("a short-term listing opened by id looks missing to a legacy caller", async () => {
    let viewRecorded = false
    prisma.property.findUnique = async () => ({ id: "p1", agencyId: "a1", listingType: "short_term_rent" })
    prisma.propertyView.create = async () => {
        viewRecorded = true
    }

    const legacy = await getPropertyService("p1", {})
    assert.equal(legacy.data, null)
    assert.equal(viewRecorded, false)

    const templates = await getPropertyService("p1", {}, { capabilities: { shortTermRent: true } })
    assert.equal(templates.data.id, "p1")
})
```

- [ ] **Step 6: Run to verify they fail**

Run: `npx tsx --test src/api/v1/services/properties/properties.service.spec.js`
Expected: the five new tests FAIL (no exclusion, no `maxGuests`, legacy detail returns the row); the five existing
tests still PASS.

- [ ] **Step 7: Gate the search**

In `src/api/v1/services/properties/properties.service.js`:

Imports:

```js
import { LEGACY_CAPABILITIES } from "#config/client_capabilities.js"
import { hiddenPropertyConditions, isPropertyVisibleTo } from "./utils/visibility.js"
```

Add `@param {Object} [options.capabilities] - req.capabilities (defaults to legacy)` to the JSDoc of
`getPropertiesService` and `getPropertyService`, and `@property {PrimitiveParam} [guests]` to `PropertyQueryParams`.

Change the options destructuring in `getPropertiesService`:

```js
        const { includeHiddenAgencies = false, promoteFeatured = true, capabilities = LEGACY_CAPABILITIES } = options
```

Directly after the hidden-agencies block (`if (!includeHiddenAgencies && HIDDEN_AGENCY_IDS.length) { … }`), add:

```js
        // Listings this caller cannot handle (e.g. short-term rent for apps before 1.1.0) are never returned.
        andConditions.push(...hiddenPropertyConditions(capabilities))
```

Directly after `if (listingType) filters.listingType = listingType`, add:

```js
        const guests = positiveInt(params.guests)
        if (guests) filters.maxGuests = { gte: guests }
```

In the promoted branch, directly after the `promotedAndConditions.unshift({ … HIDDEN_AGENCY_IDS … })` block, add:

```js
            promotedAndConditions.push(...hiddenPropertyConditions(capabilities))
```

- [ ] **Step 8: Gate the detail**

In `getPropertyService`, change the options line and the hidden-agency check:

```js
        const { includeHiddenAgencies = false, capabilities = LEGACY_CAPABILITIES } = options
```

```js
        const hiddenAgency = !includeHiddenAgencies && isHiddenAgency(property?.agencyId)
        // A listing the caller cannot handle answers exactly like a missing id, which older apps show as "not found".
        if (hiddenAgency || (property && !isPropertyVisibleTo(property, capabilities))) {
            return {
                data: null,
                message: "Property loaded successfully",
            }
        }
```

(replacing the existing `if (!includeHiddenAgencies && isHiddenAgency(property?.agencyId)) { … }` block).

- [ ] **Step 9: Pass the capabilities from the controllers**

`src/api/v1/controllers/properties/properties.controller.js`:

```js
    const properties = await getPropertiesService(req.query, { capabilities: req.capabilities })
```

```js
    const property = await getPropertyService(
        req.params.id,
        {
            ip: getIpAddress(req),
            clientId: req.user?.clientId ?? null,
        },
        { capabilities: req.capabilities }
    )
```

`src/api/v1/controllers/website/website.controller.js`, in `getWebsiteAgencyPropertiesController`:

```js
    const agencyProperties = await getPropertiesService(queryParams, {
        includeHiddenAgencies: true,
        promoteFeatured: false,
        capabilities: req.capabilities,
    })
```

- [ ] **Step 10: Run the specs to verify they pass**

Run: `npx tsx --test src/api/v1/services/properties/properties.service.spec.js src/api/v1/services/properties/utils/visibility.spec.js`
Expected: PASS (10 + 3 tests).

- [ ] **Step 11: Stage**

```bash
git add src/api/v1/services/properties src/api/v1/controllers/properties/properties.controller.js src/api/v1/controllers/website/website.controller.js
```

---

### Task 4: Favorites

**Files:**
- Modify: `src/api/v1/services/users/users_properties_favorites.service.js`
- Modify: `src/api/v1/controllers/users/users.controller.js` (`propertyFavoriteController` ~183, `getPropertiesFavoritesController` ~209)
- Test: `src/api/v1/services/users/users_properties_favorites.spec.js` (new)

**Interfaces:**
- Consumes: `hiddenPropertyConditions`, `isPropertyVisibleTo` (Task 3), `LEGACY_CAPABILITIES` (Task 2).
- Produces: `usersCreatePropertiesFavoriteService(userId, propertyId, ip, capabilities = LEGACY_CAPABILITIES)`,
  `getPropertiesFavoritesService(userId, capabilities = LEGACY_CAPABILITIES)`.

- [ ] **Step 1: Write the failing spec**

`src/api/v1/services/users/users_properties_favorites.spec.js`:

```js
import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import prisma from "#database/client.js"
import {
    getPropertiesFavoritesService,
    usersCreatePropertiesFavoriteService,
} from "./users_properties_favorites.service.js"

const originals = {
    clientFindUnique: prisma.client.findUnique,
    propertyFindUnique: prisma.property.findUnique,
    favoriteFindMany: prisma.propertyFavorite.findMany,
    favoriteFindFirst: prisma.propertyFavorite.findFirst,
}

afterEach(() => {
    prisma.client.findUnique = originals.clientFindUnique
    prisma.property.findUnique = originals.propertyFindUnique
    prisma.propertyFavorite.findMany = originals.favoriteFindMany
    prisma.propertyFavorite.findFirst = originals.favoriteFindFirst
})

test("legacy callers do not get short-term favorites", async () => {
    let where
    prisma.client.findUnique = async () => ({ id: "client_1" })
    prisma.propertyFavorite.findMany = async query => {
        where = query.where
        return []
    }

    await getPropertiesFavoritesService("user_1")
    assert.deepEqual(where, {
        clientId: "client_1",
        property: { AND: [{ listingType: { not: "short_term_rent" } }] },
    })

    await getPropertiesFavoritesService("user_1", { shortTermRent: true })
    assert.deepEqual(where, { clientId: "client_1" })
})

test("a legacy caller cannot favorite a short-term listing", async () => {
    prisma.client.findUnique = async () => ({ id: "client_1" })
    prisma.property.findUnique = async () => ({ id: "p1", listingType: "short_term_rent" })
    prisma.propertyFavorite.findFirst = async () => {
        throw new Error("must not get this far")
    }

    await assert.rejects(() => usersCreatePropertiesFavoriteService("user_1", "p1", "1.1.1.1"), { status: 404 })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx --test src/api/v1/services/users/users_properties_favorites.spec.js`
Expected: FAIL — the where has no `property` condition; favoriting reaches `findFirst`.

- [ ] **Step 3: Implement**

In `users_properties_favorites.service.js`, add imports:

```js
import { LEGACY_CAPABILITIES } from "#config/client_capabilities.js"
import { hiddenPropertyConditions, isPropertyVisibleTo } from "#services/properties/utils/visibility.js"
```

`usersCreatePropertiesFavoriteService` — signature and the existence check (add
`@param {Object} [capabilities] - req.capabilities (defaults to legacy)` to its JSDoc):

```js
const usersCreatePropertiesFavoriteService = async (userId, propertyId, ip, capabilities = LEGACY_CAPABILITIES) => {
```

```js
    // A listing the caller cannot open is treated as missing.
    if (!property || !isPropertyVisibleTo(property, capabilities)) throw createError(404, "Property not found")
```

`getPropertiesFavoritesService` — signature and query (same JSDoc line):

```js
const getPropertiesFavoritesService = async (userId, capabilities = LEGACY_CAPABILITIES) => {
```

```js
    const hiddenConditions = hiddenPropertyConditions(capabilities)
    const favorites = await prisma.propertyFavorite.findMany({
        where: {
            clientId: client.id,
            // Only filter on the relation when something is hidden, so favorites without a property keep showing.
            ...(hiddenConditions.length ? { property: { AND: hiddenConditions } } : {}),
        },
        include: {
            property: true,
        },
    })
```

In `users.controller.js`:

```js
    const result = await usersCreatePropertiesFavoriteService(userId, propertyId, getIpAddress(req), req.capabilities)
```

```js
    const result = await getPropertiesFavoritesService(userId, req.capabilities)
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx tsx --test src/api/v1/services/users/users_properties_favorites.spec.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Stage**

```bash
git add src/api/v1/services/users/users_properties_favorites.service.js src/api/v1/services/users/users_properties_favorites.spec.js src/api/v1/controllers/users/users.controller.js
```

---

### Task 5: Saved searches

**Files:**
- Modify: `src/api/v1/services/users/users_searches.service.js` (`getUserSearchesService` ~164)
- Modify: `src/api/v1/controllers/users/users_search.controller.js` (~17)
- Test: `src/api/v1/services/users/users_searches.spec.js` (new)

**Interfaces:**
- Produces: `getUserSearchesService(userId, query = {}, capabilities = LEGACY_CAPABILITIES)`; list and `total` both
  leave out searches whose `filters.listingType` is `short_term_rent` for callers without `shortTermRent`.

- [ ] **Step 1: Write the failing spec**

`src/api/v1/services/users/users_searches.spec.js`:

```js
import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import prisma from "#database/client.js"
import { getUserSearchesService } from "./users_searches.service.js"

const originals = {
    userFindUnique: prisma.user.findUnique,
    searchCount: prisma.clientSearch.count,
    searchFindMany: prisma.clientSearch.findMany,
}

afterEach(() => {
    prisma.user.findUnique = originals.userFindUnique
    prisma.clientSearch.count = originals.searchCount
    prisma.clientSearch.findMany = originals.searchFindMany
})

const stub = () => {
    const calls = { count: [], findMany: [] }
    prisma.user.findUnique = async () => ({ id: "user_1", client: { id: "client_1" } })
    prisma.clientSearch.count = async query => {
        calls.count.push(query)
        return 1
    }
    prisma.clientSearch.findMany = async query => {
        calls.findMany.push(query)
        // The positive match only selects ids; the page query returns rows.
        return query.select?.id ? [{ id: "short_term_search" }] : []
    }
    return calls
}

test("legacy callers do not get short-term saved searches, in the list or the total", async () => {
    const calls = stub()

    await getUserSearchesService("user_1", {})

    const [hiddenQuery, pageQuery] = calls.findMany
    // Positive match on the JSON path: searches without a listingType key are never matched (and so never hidden).
    assert.deepEqual(hiddenQuery.where, {
        clientId: "client_1",
        filters: { path: ["listingType"], equals: "short_term_rent" },
    })
    assert.deepEqual(calls.count[0].where, { clientId: "client_1", id: { notIn: ["short_term_search"] } })
    assert.deepEqual(pageQuery.where, { clientId: "client_1", id: { notIn: ["short_term_search"] } })
})

test("callers with the capability get every saved search with no extra query", async () => {
    const calls = stub()

    await getUserSearchesService("user_1", {}, { shortTermRent: true })

    assert.equal(calls.findMany.length, 1)
    assert.deepEqual(calls.count[0].where, { clientId: "client_1" })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx --test src/api/v1/services/users/users_searches.spec.js`
Expected: FAIL — no positive-match query; the where has no `id: { notIn }`.

- [ ] **Step 3: Implement**

In `users_searches.service.js`, add imports (keep the existing ones):

```js
import { PropertyListingType } from "#generated/prisma/enums.ts"
import { LEGACY_CAPABILITIES } from "#config/client_capabilities.js"
```

Add above `getUserSearchesService`:

```js
/**
 * Saved searches for listings the caller cannot open (short-term rent saved on the web, before app 1.1.0).
 * A positive JSON match, then notIn: a NOT on a JSON path would also drop every search without that key.
 * @param {string} clientId - Client ID
 * @param {{ shortTermRent?: boolean }} capabilities - req.capabilities
 * @returns {Promise<Object>} Extra where conditions
 */
const hiddenSearchesWhere = async (clientId, capabilities) => {
    if (capabilities.shortTermRent) return {}
    const hidden = await prisma.clientSearch.findMany({
        where: { clientId, filters: { path: ["listingType"], equals: PropertyListingType.short_term_rent } },
        select: { id: true },
    })
    return hidden.length ? { id: { notIn: hidden.map(search => search.id) } } : {}
}
```

Change `getUserSearchesService` (add `@param {Object} [capabilities] - req.capabilities (defaults to legacy)` to its
JSDoc):

```js
export const getUserSearchesService = async (userId, query = {}, capabilities = LEGACY_CAPABILITIES) => {
```

After the two `throw createError(…)` lines, add:

```js
        const where = { clientId: user.client.id, ...(await hiddenSearchesWhere(user.client.id, capabilities)) }
```

and use `where` in both the `prisma.clientSearch.count({ where })` and the paginated
`prisma.clientSearch.findMany({ where, orderBy: …, skip, take: limit })` calls.

In `users_search.controller.js`:

```js
    const result = await getUserSearchesService(userId, req.query, req.capabilities)
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx tsx --test src/api/v1/services/users/users_searches.spec.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Stage**

```bash
git add src/api/v1/services/users/users_searches.service.js src/api/v1/services/users/users_searches.spec.js src/api/v1/controllers/users/users_search.controller.js
```

---

### Task 6: Chat — start gate, inbox and thread without the hidden listing

**Files:**
- Create: `src/api/v1/services/chat/chat_visibility.js`
- Modify: `src/api/v1/services/chat/conversation.service.js` (`assertAgencyAvailable` ~75, `startAgencyInquiry` ~200)
- Modify: `src/api/v1/services/chat/chat_inbox.service.js` (`getInbox` ~58, `getThread` ~253)
- Modify: `src/api/v1/controllers/chat/chat.controller.js` (list, get, start, guest)
- Modify: `src/api/v1/controllers/chat/chat_admin.controller.js` (~33)
- Test: `src/api/v1/services/chat/chat_visibility.spec.js` (new)

**Interfaces:**
- Consumes: `hiddenPropertyConditions`, `isPropertyVisibleTo` (Task 3), `LEGACY_CAPABILITIES`, `ALL_CAPABILITIES`
  (Task 2).
- Produces:
  - `withoutHiddenProperty(conversation, capabilities = LEGACY_CAPABILITIES)` → the same object, or a copy with
    `propertyId`, `property` and `propertySnapshot` set to `null`
  - `assertAgencyAvailable({ agencyId, propertyId, capabilities })`
  - `startAgencyInquiry({ …, capabilities })`
  - `getInbox(viewer, { search, locale, limit, capabilities })`
  - `getThread(viewer, conversationId, locale, capabilities)`

- [ ] **Step 1: Write the failing spec**

`src/api/v1/services/chat/chat_visibility.spec.js`:

```js
import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import prisma from "#database/client.js"
import { withoutHiddenProperty } from "./chat_visibility.js"
import { assertAgencyAvailable } from "./conversation.service.js"
import { shapeThread } from "./chat_inbox.service.js"

const originals = {
    agencyFindUnique: prisma.agency.findUnique,
    propertyFindFirst: prisma.property.findFirst,
}

afterEach(() => {
    prisma.agency.findUnique = originals.agencyFindUnique
    prisma.property.findFirst = originals.propertyFindFirst
})

const shortTermConversation = {
    id: "conversation_1",
    kind: "AGENCY_INQUIRY",
    propertyId: "property_1",
    closedAt: null,
    property: { id: "property_1", listingType: "short_term_rent", status: "PUBLISHED", slug: "stan" },
    propertySnapshot: { name: { mk: "Стан" }, listingType: "short_term_rent", photo: null },
    participants: [],
    messages: [],
}

test("legacy callers get a short-term thread without its listing", () => {
    const stripped = withoutHiddenProperty(shortTermConversation)
    assert.equal(stripped.propertyId, null)
    assert.equal(stripped.property, null)
    assert.equal(stripped.propertySnapshot, null)
    assert.equal(stripped.id, "conversation_1")
})

test("snapshot-only rows (inbox) are stripped too", () => {
    const { property, ...inboxRow } = shortTermConversation
    assert.equal(withoutHiddenProperty(inboxRow).propertySnapshot, null)
})

test("other threads and capable callers are untouched", () => {
    assert.equal(withoutHiddenProperty(shortTermConversation, { shortTermRent: true }), shortTermConversation)
    const saleThread = { ...shortTermConversation, propertySnapshot: { listingType: "for_sale" }, property: null }
    assert.equal(withoutHiddenProperty(saleThread), saleThread)
    const noProperty = { ...shortTermConversation, propertyId: null, property: null, propertySnapshot: null }
    assert.equal(withoutHiddenProperty(noProperty), noProperty)
})

test("a stripped thread shapes like a plain agency conversation", () => {
    const thread = shapeThread({
        conversation: withoutHiddenProperty(shortTermConversation),
        viewer: { type: "client", userId: "user_1" },
        locale: "mk",
    })
    assert.equal(thread.property, null)
    assert.equal(thread.conversation.propertyId, null)
})

test("a legacy caller cannot start a chat about a short-term listing", async () => {
    let propertyWhere
    prisma.agency.findUnique = async () => ({ id: "agency_1", name: "Dom", status: "APPROVED" })
    prisma.property.findFirst = async query => {
        propertyWhere = query.where
        return null
    }

    await assert.rejects(() => assertAgencyAvailable({ agencyId: "agency_1", propertyId: "property_1" }), {
        status: 404,
    })
    assert.deepEqual(propertyWhere.AND, [{ listingType: { not: "short_term_rent" } }])

    prisma.property.findFirst = async query => {
        propertyWhere = query.where
        return { id: "property_1" }
    }
    await assertAgencyAvailable({ agencyId: "agency_1", propertyId: "property_1", capabilities: { shortTermRent: true } })
    assert.deepEqual(propertyWhere.AND, [])
})
```

(`ChatError` keeps its HTTP status in `status`, so `{ status: 404 }` matches it.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx --test src/api/v1/services/chat/chat_visibility.spec.js`
Expected: FAIL — cannot find module `./chat_visibility.js`.

- [ ] **Step 3: Create the helper**

`src/api/v1/services/chat/chat_visibility.js`:

```js
import { LEGACY_CAPABILITIES } from "#config/client_capabilities.js"
import { isPropertyVisibleTo } from "#services/properties/utils/visibility.js"

/**
 * A thread about a listing the caller cannot open (e.g. short-term rent before app 1.1.0) is returned without that
 * listing, so it shows as a plain agency conversation with every message intact.
 * @param {Object} conversation - Conversation row with property and/or propertySnapshot
 * @param {{ shortTermRent?: boolean }} [capabilities] - req.capabilities
 * @returns {Object}
 */
export const withoutHiddenProperty = (conversation, capabilities = LEGACY_CAPABILITIES) => {
    const listingType = conversation?.property?.listingType ?? conversation?.propertySnapshot?.listingType
    if (!listingType || isPropertyVisibleTo({ listingType }, capabilities)) return conversation
    return { ...conversation, propertyId: null, property: null, propertySnapshot: null }
}
```

- [ ] **Step 4: Gate chat start**

In `conversation.service.js`, add imports:

```js
import { LEGACY_CAPABILITIES } from "#config/client_capabilities.js"
import { hiddenPropertyConditions } from "#services/properties/utils/visibility.js"
```

Change `assertAgencyAvailable`:

```js
export const assertAgencyAvailable = async ({ agencyId, propertyId, capabilities = LEGACY_CAPABILITIES }) => {
```

and its property query's `where`:

```js
        where: {
            id: propertyId,
            agencyId,
            status: PropertyStatus.PUBLISHED,
            // A listing the caller cannot open answers like a missing one.
            AND: hiddenPropertyConditions(capabilities),
        },
```

Change `startAgencyInquiry`: add `capabilities = LEGACY_CAPABILITIES,` after `now = new Date(),` in its parameter
object, and pass it on:

```js
    const { agency, property } = await assertAgencyAvailable({ agencyId, propertyId, capabilities })
```

- [ ] **Step 5: Strip the listing in inbox and thread**

In `chat_inbox.service.js`, add imports:

```js
import { LEGACY_CAPABILITIES } from "#config/client_capabilities.js"
import { withoutHiddenProperty } from "./chat_visibility.js"
```

`getInbox` signature and return:

```js
export const getInbox = async (
    viewer,
    { search = "", locale = "mk", limit = INBOX_PAGE_SIZE, capabilities = LEGACY_CAPABILITIES } = {}
) => {
```

```js
    return {
        items: rows
            .slice(0, cappedLimit)
            .map(row => inboxItem({ ...row, conversation: withoutHiddenProperty(row.conversation, capabilities) }, locale)),
        hasMore: rows.length > cappedLimit,
    }
```

`getThread` signature and shaping:

```js
export const getThread = async (viewer, conversationId, locale = "mk", capabilities = LEGACY_CAPABILITIES) => {
```

```js
    const thread = shapeThread({ conversation: withoutHiddenProperty(conversation, capabilities), viewer, locale })
```

- [ ] **Step 6: Pass the capabilities from the controllers**

`chat.controller.js`:
- `listConversationsController`: add `capabilities: req.capabilities,` to the options object passed to `getInbox`.
- `getConversationController`:
  `const thread = await getThread(req.chatViewer, req.params.id, locale(req.query.locale), req.capabilities)`
- `startConversationController`: add `capabilities: req.capabilities,` to the object passed to `startAgencyInquiry`.
- `guestController`: pass `capabilities: req.capabilities` to `assertAgencyAvailable({ … })` and to
  `startInquiry({ … })`.

`chat_admin.controller.js` (moderators always see the listing):

```js
import { ALL_CAPABILITIES } from "#config/client_capabilities.js"
```

```js
    const thread = await getThread(req.chatViewer, req.params.id, req.query.locale || "mk", ALL_CAPABILITIES)
```

- [ ] **Step 7: Run the chat specs**

Run: `npx tsx --test src/api/v1/services/chat/*.spec.js`
Expected: PASS (the new spec's 5 tests and every existing chat spec).

- [ ] **Step 8: Stage**

```bash
git add src/api/v1/services/chat src/api/v1/controllers/chat
```

---

### Task 7: Price statistics allow-list

**Files:**
- Modify: `src/api/v1/services/analytics/analytics.service.js` (`getPriceTrendsService` ~58, `getPricePerSqmService` ~170)
- Modify: `src/api/v1/controllers/analytics/analytics.controller.js` (both price controllers)
- Test: `src/api/v1/services/analytics/analytics.service.spec.js` (new)

**Interfaces:**
- Produces: `PRICE_STATS_LISTING_TYPES = ["for_sale", "for_rent"]`; both price services return
  `{ success: false, status: 400, error: "unsupportedListingType" }` for any other `listingType`, and add
  `"listingType"::text IN ('for_sale', 'for_rent')` when none is given.

- [ ] **Step 1: Write the failing spec**

`src/api/v1/services/analytics/analytics.service.spec.js`:

```js
import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import prisma from "#database/client.js"
import { getPricePerSqmService, getPriceTrendsService } from "./analytics.service.js"

const originalQueryRaw = prisma.$queryRawUnsafe

afterEach(() => {
    prisma.$queryRawUnsafe = originalQueryRaw
})

const captureSql = () => {
    const calls = []
    prisma.$queryRawUnsafe = async (sql, ...params) => {
        calls.push({ sql, params })
        return []
    }
    return calls
}

test("nightly prices never enter price statistics", async () => {
    for (const service of [getPriceTrendsService, getPricePerSqmService]) {
        const calls = captureSql()
        const result = await service({ listingType: "short_term_rent" })
        assert.deepEqual(result, { success: false, status: 400, error: "unsupportedListingType" })
        assert.equal(calls.length, 0)
    }
})

test("without a listing type only sale and long-term rent are averaged", async () => {
    for (const service of [getPriceTrendsService, getPricePerSqmService]) {
        const calls = captureSql()
        await service({})
        assert.match(calls[0].sql, /"listingType"::text IN \('for_sale', 'for_rent'\)/)
    }
})

test("an explicit sale or rent listing type still works as before", async () => {
    const calls = captureSql()
    await getPriceTrendsService({ listingType: "for_rent" })
    assert.ok(calls[0].params.includes("for_rent"))
    assert.doesNotMatch(calls[0].sql, /IN \('for_sale', 'for_rent'\)/)
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx --test src/api/v1/services/analytics/analytics.service.spec.js`
Expected: FAIL — short-term is queried; no `IN` clause.

- [ ] **Step 3: Implement**

In `analytics.service.js`, below `normalizeLocationId`, add:

```js
// Nightly (short-term) prices must never be averaged with sale or monthly prices, for any caller.
export const PRICE_STATS_LISTING_TYPES = ["for_sale", "for_rent"]
const UNSUPPORTED_LISTING_TYPE = { success: false, status: 400, error: "unsupportedListingType" }
const isUnsupportedListingType = listingType => Boolean(listingType) && !PRICE_STATS_LISTING_TYPES.includes(listingType)
const priceStatsListingTypesSql = alias =>
    `${alias}."listingType"::text IN (${PRICE_STATS_LISTING_TYPES.map(type => `'${type}'`).join(", ")})`
```

In `getPriceTrendsService`, as the first line inside `try` after the destructuring:

```js
        if (isUnsupportedListingType(listingType)) return UNSUPPORTED_LISTING_TYPE
```

and replace its `if (listingType) { … }` block with:

```js
        if (listingType) {
            joinConditions.push(`mt."listingType"::text = $${paramIndex}`)
            queryParams.push(listingType)
            paramIndex++
        } else {
            joinConditions.push(priceStatsListingTypesSql("mt"))
        }
```

In `getPricePerSqmService`, the same first-line guard, and replace its `if (listingType) { … }` block with:

```js
        if (listingType) {
            whereConditions.push(`mv."listingType"::text = $${queryParams.length + 1}`)
            queryParams.push(listingType)
        } else {
            whereConditions.push(priceStatsListingTypesSql("mv"))
        }
```

Update both JSDoc `@returns` to mention `status`.

In `analytics.controller.js`, both price controllers: replace `res.status(500)` in the `!result.success` branch with
`res.status(result.status ?? 500)`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx tsx --test src/api/v1/services/analytics/analytics.service.spec.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Stage**

```bash
git add src/api/v1/services/analytics src/api/v1/controllers/analytics/analytics.controller.js
```

---

### Task 8: Final verification

- [ ] **Step 1: Every spec**

Run: `npx tsx --test src/api/v1/middlewares/*.spec.js src/api/v1/services/**/*.spec.js`
Expected: PASS, no failures.

- [ ] **Step 2: Nothing calls a gated service without thinking about capabilities**

Run: `rg -n "getPropertiesService\(|getPropertyService\(|getPropertiesFavoritesService\(|usersCreatePropertiesFavoriteService\(|getUserSearchesService\(|getInbox\(|getThread\(|startAgencyInquiry\(|startInquiry\(|assertAgencyAvailable\(" src --glob '!*.spec.js'`
Expected: every controller call passes `req.capabilities` (admin passes `ALL_CAPABILITIES`); every other call relies on
the legacy default on purpose.

- [ ] **Step 3: Format**

Run: `npx prettier --check src/config/client_capabilities.js src/api/v1`
Expected: no differences (run `--write` on the touched files if needed).

- [ ] **Step 4: Local smoke test against a dev database that has one short-term listing**

Start the server (`npm run dev`), then:

```bash
curl -s "http://localhost:5050/api/v1/properties?listingType=short_term_rent" | jq '.pagination.total'
curl -s -H "X-Imotko-Client: templates" "http://localhost:5050/api/v1/properties?listingType=short_term_rent" | jq '.pagination.total'
curl -s -H "X-Imotko-Client: mobile" -H "X-Imotko-App-Version: 1.1.0" "http://localhost:5050/api/v1/properties?listingType=short_term_rent" | jq '.pagination.total'
```

Expected: `0`, then at least `1`, then `0` (the minimum version is unset).

- [ ] **Step 5: Report**

Do not commit. Report "Ready to commit — <summary>" and remind the owner of release step 2 (roadmap §4): deploy
Express with `MOBILE_MIN_VERSION_SHORT_TERM_RENT` unset, then check **app 1.0.5 on a real phone**: search, details,
favorites (list and add), saved searches, chat (inbox, thread, start), price trend on a details screen.
