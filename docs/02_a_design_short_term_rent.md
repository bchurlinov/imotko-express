# Short-Term Rent Listing Type — Design (Sub-project A)

**Date:** 2026-10-05
**Status:** Approved 2026-10-05
**Flag:** `NEXT_PUBLIC_SHORT_TERM_RENT_ENABLED`
**Repos:** `imotko` (web), `imotko-express` (API for the app and agency websites), `imotko-templates` (agency
websites). `imotko-mobile` is **not** changed in A; the app gets short-term in its 1.1.0 release (sub-project D,
last). Until then every app version in the stores must keep working against the new Express unchanged.
**Related:** release order and compatibility rules in
`docs/marketplace-rollout/00_roadmap.md`; decisions log in
`docs/marketplace-rollout/01_decisions_log.md` (section "2026-10-05 brainstorm").
Sub-projects B (client listings) and C (agency outreach) build on this one and get their own specs.

---

## 1. Goal

Add a third listing type, **short-term rent** (stays priced per night), next to sale and long-term rent. Agencies (and,
after sub-project B, clients) can publish it; visitors can search and filter for it. At the same time, replace the
"price ≤ €50 means €/m²" guess with an explicit price unit stored on every property.

### Success criteria

- An agency can create, edit, and publish a short-term listing with guests, minimum nights, optional check-in/check-out
  times, and short-term amenities; the price always shows "€ X / ноќ".
- Visitors reach short-term listings from the navbar dropdown, the hero search, and the filter chips, and can filter by
  number of guests and short-term amenities.
- No price statistic (trend chart, market reports, landing averages) mixes nightly or per-square-meter values with
  total monthly or sale prices; price statistics use only `priceUnit: TOTAL`.
- Every existing property keeps rendering the same price label it shows today (no visual regression after migration).
- With the flag off, nothing about short-term rent is visible and the API rejects it.
- **App 1.0.5 and older keep working unchanged, for as long as anyone uses them**: they never receive a short-term
  listing, opening one by id shows the existing "not found" screen, and their price statistics never include nightly
  prices.
- Express is ready for app 1.1.0: it shows short-term listings to an app only when its version is at or above
  `MOBILE_MIN_VERSION_SHORT_TERM_RENT`, which stays unset (off for every app) until sub-project D.
- Agency websites show an agency's short-term listings with "€ X / ноќ" and the stay details.

### Non-goals

- Any change to `imotko-mobile`, and Express's app-facing extras (`GET /api/v1/app/config`, update prompts) — all
  sub-project D.

- Availability calendar, bookings, or payments.
- Short-term leads, CRM client preferences, client requests, or estimations.
- Hommex sync for short-term listings.
- Changing how per-m² rent prices behave in the search price filter.

---

## 2. Data model

`prisma/schema/property.prisma`:

```prisma
enum PropertyListingType {
  for_rent
  for_sale
  short_term_rent
}

enum PropertyPriceUnit {
  TOTAL
  PER_SQUARE_METER
  PER_NIGHT
}

model Property {
  // ...existing fields
  priceUnit     PropertyPriceUnit @default(TOTAL)
  maxGuests     Int?
  minNights     Int?
  checkInFrom   String?   // "HH:mm"
  checkOutUntil String?   // "HH:mm"
}
```

`for_rent` keeps its value; only its labels change to "long-term". `ClientPropertySubscription.listingType` shares the
enum, so saved searches can target short-term with no extra change.

### Migration

One migration (`npx prisma migrate dev --create-only --name short_term_rent`), hand-edited SQL:

1. Add the enum value, the new enum, and the five columns (`priceUnit` defaults to `TOTAL` for every existing row).
2. Backfill: `UPDATE "Property" SET "priceUnit" = 'PER_SQUARE_METER' WHERE "listingType" = 'for_rent' AND price > 0 AND
   price <= 50;` — this keeps today's "€/m²" label on those rows.
3. Sale rows with `price > 0 AND price <= 50` stay `TOTAL`. A read-only SQL report
   (`scripts/report_low_price_sale_properties.sql`) lists their ids, agency, and price so an admin can correct them.

Adding a value to a Postgres enum cannot run in the same transaction that uses it; the migration adds the value in its
own statement before any use (Prisma generates this correctly when the value is unused in the same file).

The migration is **additive only**: the current production web and Express builds (whose Prisma clients know neither
the enum value nor the columns) keep working against the migrated database, because no row uses `short_term_rent` until
the web flag is switched on, and new columns have defaults or are nullable. It is applied by hand from this repo with
`npx prisma migrate deploy` (release step 1 in §11.6), and the same schema files and migration folder are copied into
`imotko-express` (§11.1).

---

## 3. Listing type rules (single source of truth)

New file `src/lib/property/listing_type_rules.js`:

```js
export const LISTING_TYPE_RULES = {
    [PropertyListingType.for_sale]: {
        propertyTypes: ALL_PROPERTY_TYPES,
        priceUnits: [PropertyPriceUnit.TOTAL],
        defaultPriceUnit: PropertyPriceUnit.TOTAL,
        hiddenFields: [],
        requiredFields: [],
        priceRange: { min: 10_000, max: 1_000_000, step: 10_000, maxPlusLabel: "2M +", maxPlusValue: "20000000" },
        inPriceStats: true,
    },
    [PropertyListingType.for_rent]: {
        propertyTypes: ALL_PROPERTY_TYPES,
        priceUnits: [PropertyPriceUnit.TOTAL, PropertyPriceUnit.PER_SQUARE_METER],
        defaultPriceUnit: PropertyPriceUnit.TOTAL,
        hiddenFields: [],
        requiredFields: [],
        priceRange: { min: 100, max: 5_000, step: 50, maxPlusLabel: "5,000+", maxPlusValue: "50000" },
        inPriceStats: true,
    },
    [PropertyListingType.short_term_rent]: {
        propertyTypes: [PropertyType.flat, PropertyType.house, PropertyType.holiday_home],
        priceUnits: [PropertyPriceUnit.PER_NIGHT],
        defaultPriceUnit: PropertyPriceUnit.PER_NIGHT,
        hiddenFields: ["inDevelopment", "inDevelopmentUntil", "hasApproximatePrice", "approximatePrice", "estimationPrice"],
        requiredFields: ["maxGuests", "minNights"],
        priceRange: { min: 10, max: 300, step: 5, maxPlusLabel: "300+", maxPlusValue: "3000" },
        inPriceStats: false,
    },
};
```

Exported helpers: `getListingTypeRules(listingType)`, `isPropertyTypeAllowed(listingType, type)`,
`isPriceUnitAllowed(listingType, unit)`, `getListingTypeOptions(locale, { includeShortTerm })`.

The existing slider helpers in `property_additional_filters.jsx` (`maxPriceValue`, `minPriceValue`, `getPriceStep`,
`getMaxPlusLabel`, `getMaxPlusValue`) read `priceRange` from here instead of their hardcoded branches; the "no listing
type selected" defaults stay as they are.

---

## 4. Feature flag

New file `src/lib/feature_flags.js`:

```js
export const isShortTermRentEnabled = () => process.env.NEXT_PUBLIC_SHORT_TERM_RENT_ENABLED === "true";
```

`NEXT_PUBLIC_` so the same value works in server and client components; toggling needs a redeploy. Sub-projects B and C
add their flags to the same file.

Flag off:
- Navbar, mobile menu, hero search, filter chips, save-search dialog, and the property form do not offer short-term.
- `POST /api/properties` and `PUT /api/properties/[id]` return 400 `propertyListingTypeRequired` for `short_term_rent`.
- Public queries are unchanged (no short-term rows exist while the flag is off).

---

## 5. Property form (create / edit)

All in `src/components/modules/dashboard/property/`; `property.jsx` gains only the conditional render of the new block.

| Part | Change |
|------|--------|
| `property_information.jsx` | Listing-type select uses `getListingTypeOptions(locale, { includeShortTerm: isShortTermRentEnabled() })`. `for_rent` label becomes "Долгорочно изнајмување"; new "Краткорочно изнајмување". Property-type options are filtered with `isPropertyTypeAllowed`; an invalid current type is cleared with an error. On listing-type change: `setValue("priceUnit", defaultPriceUnit)` and reset that type's `hiddenFields`. |
| `property_price.jsx` | Sale: price + approximate-price checkbox (unchanged). Long-term rent: unit toggle "Вкупно / по m²". Short-term: "€ / ноќ" adornment, no approximate price. Helper text for `TOTAL`: "Внесете ја вкупната цена". |
| `property_stay_details.jsx` (new, ~80 lines) | Rendered only for short-term, between overview and location. Fields: max guests (required int ≥ 1), min nights (required int ≥ 1), check-in from, check-out until (optional time pickers, `HH:mm`). |
| `construction_details.jsx` | Hides the in-development controls for short-term. |
| `property_amenities.jsx` | Shows an amenity when its property type matches (as today) **and** its `listingTypes` is absent or includes the current listing type. |
| `property_utils.js` (`fromPropertyDto`) | Maps `priceUnit`, `maxGuests`, `minNights`, `checkInFrom`, `checkOutUntil`. |

Default values for a new property: `priceUnit: TOTAL`.

### Amenities

`PropertyFeaturesDictionary` entries get an optional `listingTypes` array. Ten new entries, each
`visible: [flat, house, holiday_home]`, `listingTypes: [short_term_rent]`: `babyCrib`, `wifi`, `tv`, `washingMachine`,
`dishwasher`, `linensAndTowels`, `workspace`, `selfCheckIn`, `bbq`, `smokingAllowed`. They are stored in `attributes`
like every other amenity (no migration) and get icons in the filter `FEATURE_ICONS` map.

---

## 6. Validation (shared by form and API)

`src/schemas/property.schema.js` is used client-side and by both property API routes, so these rules apply on both
sides:

- `listingType`: `oneOf(Object.values(PropertyListingType))`.
- `type`: test `isPropertyTypeAllowed(listingType, type)` → `propertyTypeNotAllowedForListingType`.
- `priceUnit`: test `isPriceUnitAllowed(listingType, priceUnit)` → `priceUnitNotAllowed`.
- `maxGuests`, `minNights`: when `listingType === short_term_rent` → required integer ≥ 1; otherwise optional.
- `checkInFrom`, `checkOutUntil`: optional, `/^([01]\d|2[0-3]):[0-5]\d$/`.
- `inDevelopmentUntil`, `hasApproximatePrice`, `estimationPrice`: never required for short-term.

`getPropertyRequiredFields` takes `listingType` and adds `maxGuests: true`, `minNights: true` for short-term so the
required-field star (`PropertyRequiredIndicator`) shows.

### API normalization

In `src/app/api/properties/route.js` (create DTO near line 70) and `src/app/api/properties/[id]/route.js` (update):

- Reject `short_term_rent` when the flag is off.
- `priceUnit` = body value if allowed, else the rule's `defaultPriceUnit`.
- Not short-term → `maxGuests`, `minNights`, `checkInFrom`, `checkOutUntil` saved as `null`.
- Short-term → `inDevelopment: false`, `inDevelopmentUntil: null`, `hasApproximatePrice: false`, `approximatePrice: null`,
  `estimationPrice: null`, and Hommex publication forced off.

Listings may switch listing type on edit; the same rules apply and admin re-review behaves as today.

---

## 7. Price display

New file `src/utils/property_price.js`:

```js
formatPropertyPrice({ price, priceUnit, listingType, locale, t }) // → "€ 40 / ноќ"
```

| Case | Output |
|------|--------|
| `PER_NIGHT` | `€ 40 / ноќ` |
| `PER_SQUARE_METER` | `€ 8 / m²` |
| `TOTAL` + long-term rent | `€ 450 / месечно` |
| `TOTAL` + sale | `€ 95.000` |
| no price | existing "price on request" text |

Callers (replacing their own formatting / the heuristic):
`property_card.jsx`, `map_property_card.jsx`, the details page price block and mobile price bar
(`nedviznini/[slug]/[id]/page.jsx`), chat `property_panel.jsx` and `property_context_card.jsx`,
`promoted_properties_section.jsx`, and saved-search emails (`src/actions/email.js`). The Facebook publication queue
does not render a price, so it needs no change.

`src/components/elements/property_card/property_card_price.js` is deleted. The card's derived "€ X / m²" line shows only
for sale listings with `TOTAL` price.

Selects that load property rows for display must add `priceUnit` (and, on the details page, the four stay fields) to
their Prisma `select`.

---

## 8. Public surfaces

### Details page (`src/app/[locale]/(public)/nedviznini/[slug]/[id]/`)

- New "Сместување" block for short-term: guests, minimum nights, check-in from / check-out until (when set).
- Short-term amenities render in the existing amenities list.
- Price trend: not fetched and not rendered when `inPriceStats` is false.
- Loan calculator: condition changes from `listingType !== for_rent` to `listingType === for_sale` (line 221).
- JSON-LD `Offer` for short-term adds `priceSpecification: { "@type": "UnitPriceSpecification", price, priceCurrency:
  "EUR", unitCode: "DAY" }`.

### Navbar (`src/components/modules/navbar/`)

Flag on: "Изнајмување" becomes a dropdown — "Долгорочно" → `ROUTE_URL.SEARCH_PROPERTIES_FOR_RENT?f={listingType:
for_rent}`, "Краткорочно" → new `ROUTE_URL.SEARCH_PROPERTIES_SHORT_TERM_RENT` (`/prebaruvanje/nedviznini/kratkorocno-
iznajmuvanje`) `?f={listingType: short_term_rent}`. The mobile drawer shows the two items as a nested list. Active state
matches either path. Flag off: today's single link.

### Search page (`src/app/[locale]/(public)/prebaruvanje/nedviznini/[[...params]]/`)

The path segment is cosmetic; the filter is `listingType` inside `?f=`. Needed:
- Meta title/description entry `kratkorocno-iznajmuvanje` in `meta_title_descriptions.js` (mk/en/sq).
- Sitemap entry for the new path (`src/data/sitemap/sitemap.js`), flag-gated.

### Hero search (`src/app/[locale]/(public)/hero_inputs.jsx`)

Flag on: options Купи / Изнајми долгорочно / Изнајми краткорочно.

### Filters

- `property_additional_filters.jsx` and `property_filters.jsx`: listing-type chips/selects from `getListingTypeOptions`.
  When short-term is selected: property-type chips narrow to the rule's types, a "Гости" counter appears (filter key
  `guests`, meaning `maxGuests >= N`), short-term amenity chips are added, the in-development switch is hidden.
- `save_search_dialog.jsx`: listing-type select includes short-term when the flag is on.
- `src/data/properties/properties.js`: `guests` added to the allowed filter keys and to the where-builder
  (`where.maxGuests = { gte: Number(guests) }`); the new amenity keys follow the existing amenity filter path.

---

## 9. Where short-term is deliberately excluded

| Area | Mechanism |
|------|-----------|
| CRM client preferences (`client_preferences_add.jsx`), client requests (`client_request_create.jsx`), estimations (`estimate_filters.jsx`) | `getListingTypeOptions(locale, { includeShortTerm: false })` |
| Leads and lead matching | No short-term lead intent; matcher already compares listing types |
| Price trends, market reports, landing averages | Web code already queries `for_sale` / `for_rent` explicitly (a test pins this); the trend data itself comes from Express analytics, which gets a listing-type allow-list (§11.3) |
| Hommex | `hommex_mapper.js` returns "skip" for `short_term_rent`; API forces `publishToHommex: false` |
| External listings cron | Unchanged (imports sale/rent only) |

Label lookups (`getPropertyListingTypeLabel`, admin and agency tables, gallery, exports, emails) use the full dictionary,
so short-term rows always get a label.

The AI enrichment prompt (`src/lib/ai/property_enrichment.js`) gains a rule: short-term titles start with "Се издава за
ноќевање".

The agency dashboard analytics include short-term listings normally.

---

## 10. Copy and translations

`PropertyListingTypeDictionary` (en/mk/sq/tr) gets the third entry; `for_rent` labels become long-term ("За долгорочно
изнајмување" / "Long-term rent" / "Me qira afatgjatë" / "Uzun dönem kiralık"). New keys in `messages/{mk,en,sq}.json`:
listing type labels, price unit labels and suffixes ("/ ноќ", "/ m²", "/ месечно"), "Вкупно / по m²" toggle, "Внесете ја
вкупната цена", stay block labels (guests, minimum nights, check-in from, check-out until, "Сместување"), the 10
amenities, "Гости" filter, navbar dropdown items, hero option, search meta copy, new validation messages
(`propertyTypeNotAllowedForListingType`, `priceUnitNotAllowed`, `maxGuestsRequired`, `minNightsRequired`,
`invalidTime`).

---

## 11. Backwards compatibility: Express, agency websites, public API

Rules come from the roadmap (`00_roadmap.md` §2). This section is what A needs outside the
web UI.

### 11.1 Express schema sync (`imotko-express`)

- Copy `prisma/schema/property.prisma` changes (enum value, `PropertyPriceUnit`, five columns) and the new migration
  folder into `imotko-express`; run `npx prisma generate` there. Express never applies the migration.
- Express must be deployed with the synced schema **before** the web flag is switched on, so its Prisma client knows
  `short_term_rent` before any such row exists (we could not confirm that an older Prisma 7 client tolerates an unknown
  enum value on read, so we do not rely on it).
- Responses gain `priceUnit`, `maxGuests`, `minNights`, `checkInFrom`, `checkOutUntil` automatically where Express
  returns whole rows. Additive; the app ignores unknown fields.

### 11.2 Caller capabilities in Express

New middleware `attachClientCapabilities` (mounted for all `/api/v1` routes) reads:

| Header | Meaning |
|--------|---------|
| `X-Imotko-Client: templates` | Agency websites (we deploy them; no version) |
| `X-Imotko-Client: mobile` + `X-Imotko-App-Version: 1.1.0` | The app, from 1.1.0 on (sub-project D) |
| neither | Legacy caller — every app in the stores today, and any unknown caller |

It sets `req.capabilities = { shortTermRent: boolean }` (B and C add their own keys) from:

```js
// src/config/client_capabilities.js
// Unset env → null → off for every app. Stays unset until the app 1.1.0 release (sub-project D).
export const FEATURE_MIN_APP_VERSION = {
    shortTermRent: process.env.MOBILE_MIN_VERSION_SHORT_TERM_RENT || null,
};
export const TEMPLATES_FEATURES = { shortTermRent: true };
```

Legacy callers, unknown `X-Imotko-Client` values, unparsable versions and app versions below the minimum get `false`.
Versions are compared numerically per segment (`1.0.10` > `1.0.9`).

### 11.3 Where Express applies the gate

When `req.capabilities.shortTermRent` is `false`:

| Path | Behaviour |
|------|-----------|
| `getPropertiesService` (`properties.service.js`) — app search, map, featured/promoted, similar, `ids=` lookups, and `/website/agency-properties` | Adds `listingType: { not: "short_term_rent" }` to the where (also to the promoted/featured where). An explicit `listingType=short_term_rent` returns an empty page. |
| `GET /api/v1/properties/:id` (`properties.service.js:~409`) | 404 for a short-term listing. |
| `GET /api/v1/users/:id/favorites` | Leaves out short-term listings. |
| `POST /api/v1/users/:id/favorites/:propertyId` | 404 for a short-term listing. |
| Chat: starting a conversation about a property (`conversation.service.js:~87`) | 404 for a short-term listing. |
| Chat: inbox list and thread detail (`chat_inbox.service.js`, `conversation.service.js`) | A thread about a short-term listing (started on the web) is returned **without its property** (`property: null`), so it shows as a plain agency conversation with every message intact. The app already renders threads without a property. |
| Saved searches: `GET /api/v1/users/:id/searches` (`clientSearch` in the users searches service) | Leaves out saved searches whose `filters.listingType` (JSON) is `short_term_rent` (saved on the web), from both the list and its `total` — Prisma JSON filter `NOT: { filters: { path: ["listingType"], equals: "short_term_rent" } }`. Otherwise the app would list them and open an empty result. |
| Analytics (`analytics.service.js`) — all callers, not only legacy | `listingType` is allow-listed to `for_sale` / `for_rent`; when absent, the query adds `listingType IN ('for_sale','for_rent')`. Nightly prices never enter averages, for the web trend chart either. |

The services receive `capabilities` as an explicit argument (controllers pass `req.capabilities`), so jobs and admin
code that call them without it get the legacy-safe default.

Express search also accepts `guests` (`maxGuests >= N`, same parsing as the web's `buildStayWhere`) so the agency
websites and, later, the app can use it.

### 11.4 Agency websites (`imotko-templates`)

- `src/utils/api_client.js` sends `X-Imotko-Client: templates` on every Express request.
- `src/utils/property_price.js` replaces its ≤ 50 heuristic with the same `priceUnit`-based logic as the web
  (`formatPropertyPrice`, `shouldShowSalePricePerSquareMeter`), with the same per-locale suffixes.
- Listing type labels and enums (`src/lib/property.js`, `src/constants/enums.js`, `messages/*.json`) gain
  `short_term_rent`; property cards (default and modern templates) and the details page show "/ ноќ" and the stay
  details (guests, minimum nights, check-in/out); amenity labels for the 10 new amenities.
- The agency-site search shows the short-term listing-type option and the per-night price range. The guests filter
  and short-term amenity filters are **not** added to agency websites in A.
- Structured data on agency sites adds the same per-night `priceSpecification` as the web.

### 11.5 This repo's public API

`GET /api/properties`, `GET /api/properties/criteria` and `GET /api/properties/[id]` are public (documented in
OpenAPI) **and** used by the website itself (`src/lib/service_actions/property.js` → map view, latest, featured,
similar listings). So:

- Both list endpoints leave out `short_term_rent` unless the caller passes `listingType=short_term_rent` or
  `include=short_term_rent`.
- The website's own service actions (`getProperties`, `getPropertiesByCriteria`) always send
  `include=short_term_rent` when `isShortTermRentEnabled()`; third-party callers keep today's results.
- The detail endpoint returns short-term listings (a caller only reaches one by id after asking for them).
- `publicPropertySelect` gains `priceUnit`, `maxGuests`, `minNights`, `checkInFrom`, `checkOutUntil`. Additive.
- Server-rendered pages that call `src/data/properties/*` directly (search page, landings) are not affected: they are
  not the public API and always include short-term.

### 11.6 Release steps for A

From roadmap §4, specialised for A. Each step is checked before the next.

| Step | Repo | Action | Check |
|------|------|--------|-------|
| 1 | `imotko` | `npx prisma migrate deploy` (additive migration) | Production web and Express unchanged; run the low-price SQL report |
| 2 | `imotko-express` | Deploy synced schema, capabilities middleware, gates, analytics allow-list, `guests` filter | App 1.0.5 on a real phone: search, details, favorites, chat, trends unchanged |
| 3 | `imotko` | Deploy web with `NEXT_PUBLIC_SHORT_TERM_RENT_ENABLED` unset | Website unchanged except the price-label changes (rent "/ месечно") |
| 4 | `imotko-templates` | Deploy header, price logic, short-term display | An agency site renders as before |
| 5 | `imotko` | Set `NEXT_PUBLIC_SHORT_TERM_RENT_ENABLED=true`, redeploy | Publish a short-term test listing; it shows on web and on that agency's site, not in app 1.0.5 |
| 6 | — | Stable period (owner decides) | No related errors in PostHog / Sentry / Vercel / Railway logs |

`MOBILE_MIN_VERSION_SHORT_TERM_RENT` stays unset through every step; it is set only in sub-project D, when app 1.1.0
is released.

Rollback: unset the flag and redeploy the web. Apps were never affected.

### 11.7 Known gaps for app 1.0.5 and older (permanent)

- It still guesses "rent price < 100 means per m²" and ignores `priceUnit`; a per-m² rent above that renders as a
  monthly total. Cosmetic, no crash. Fixed in app 1.1.0 (D), which reads `priceUnit`.
- It shows no short-term listings at all, and never will.

---

## 12. Testing

**Web (`imotko`, Vitest next to the code):**
- `listing_type_rules.test.js` — allowed types/units, defaults, `getListingTypeOptions` with and without short-term.
- `property_price.test.js` — every row of the table in §7, plus rows without `priceUnit`.
- `property.schema.test.js` — short-term requires guests/nights, rejects land, rejects `PER_SQUARE_METER` for sale and
  short-term, accepts valid `HH:mm`, does not require in-development or approximate price for short-term.
- `properties.test.js` — `guests` filter builds `maxGuests: { gte }`, ignores junk values.
- `hommex_mapper.test.js` — short-term is skipped.
- Normalization tests — flag off rejects short-term; stay fields nulled for other listing types; `priceUnit` defaulted.
- Public API — list endpoints leave out short-term without `include=short_term_rent` / `listingType=short_term_rent`.
- Price statistics test — trend/market/landing queries never include `short_term_rent`.

**Express (`imotko-express`, its existing spec setup):**
- `attachClientCapabilities` — no header → legacy; `X-Imotko-Client: templates` → short-term on; `mobile` with any
  version while `MOBILE_MIN_VERSION_SHORT_TERM_RENT` is unset → off; set to `1.1.0` → `1.0.5` off, `1.1.0` and
  `1.10.0` on; garbage version → off.
- `getPropertiesService` — legacy where excludes short-term (normal and promoted queries); explicit
  `listingType=short_term_rent` from a legacy caller returns nothing; templates caller gets it.
- Detail, favorites (list and add), chat start, saved searches — 404 / filtered for legacy callers; a thread about a
  short-term listing comes back with `property: null`.
- Analytics — `listingType=short_term_rent` rejected; no listing type → only sale and long-term rent, including demand
  analytics. Price statistics use only `priceUnit: TOTAL`.

**Templates (`imotko-templates`):** price helper tests (or a manual table check if the repo has no test runner);
`api_client.js` sends the header.

**Manual:** the release checks in §11.6, including app 1.0.5 on a real phone against the deployed Express; create,
edit, and switch listing type in the agency form; navbar dropdown on desktop and mobile; filters with guests and
amenities; details page for each listing type; an agency site with a short-term listing; flag off hides everything.

---

## 13. Files touched (summary)

**`imotko` — new:** `src/lib/property/listing_type_rules.js`, `src/lib/feature_flags.js`, `src/utils/property_price.js`,
`src/components/modules/dashboard/property/property_stay_details.jsx`, `scripts/report_low_price_sale_properties.sql`,
one Prisma migration, tests listed above.

**`imotko` — changed:** `prisma/schema/property.prisma`, `src/schemas/property.schema.js`,
`src/lib/dictionaries/property.js`, `src/app/api/properties/route.js`, `src/app/api/properties/[id]/route.js`,
`src/app/api/properties/criteria/route.js`, `src/lib/service_actions/property.js`, `src/lib/public_api_fields.js`, the
form components in §5, the price callers in §7, the details page, navbar + mobile drawer, `hero_inputs.jsx`, search
filters, `save_search_dialog.jsx`, `properties.js`, `meta_title_descriptions.js`, `seo.js`, `sitemap.js`,
`route_url.js`, `hommex_mapper.js`, `property_enrichment.js`, the three CRM/estimate pickers in §9,
`messages/{mk,en,sq}.json`, and the OpenAPI property docs (`src/lib/openapi/operations/properties.js`).

**`imotko` — deleted:** `src/components/elements/property_card/property_card_price.js`.

**`imotko-express`:** `prisma/schema/property.prisma` + migration folder (copied), new
`src/api/v1/middlewares/client_capabilities.js`, `src/config/client_capabilities.js`, route mounting in
`src/api/v1/routes/index.js`, `properties.service.js` (+ controller), favorites service/controller, users searches service, chat
`conversation.service.js`, `analytics.service.js`, specs.

**`imotko-templates`:** `src/utils/api_client.js`, `src/utils/property_price.js`, `src/lib/property.js`,
`src/constants/enums.js`, property cards (default and modern), details page, search filters, structured data,
`src/messages/*.json`.

**`imotko-mobile`:** none (sub-project D, app 1.1.0).
