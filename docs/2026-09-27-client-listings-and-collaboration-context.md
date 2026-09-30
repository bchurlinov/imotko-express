# Client Listings (Phase 2) and Agency Collaboration (Phase 3): Context and Prerequisites

**Status:** not designed yet. This file keeps every decision and finding from the 2026-09-27 brainstorm so the
Phase 2 and Phase 3 brainstorms start from here instead of from zero. Each phase still needs its own
brainstorm → spec → plan cycle.

**Related:** Phase 1 spec `docs/superpowers/specs/2026-09-27-chat-inbox-design.md`, Phase 1 plan
`docs/superpowers/plans/2026-09-27-chat-inbox.md`.

---

## Roadmap

| Phase | Name | Flag | Depends on | State |
|-------|------|------|------------|-------|
| 1 | Chat inbox (client ↔ agency) | `CHAT_ENABLED` | — | Spec + plan written |
| 2 | Client-published listings | `CLIENT_LISTINGS_ENABLED` | Phase 1 | This document |
| 3 | Agency collaboration section | `AGENCY_COLLAB_ENABLED` | Phases 1 and 2 | This document |

Release order was set by the product owner: chat first, then client listings, then the collaboration
section. All flags are environment variables that do not exist in production until set.

---

## Prerequisites before Phase 2 starts

1. **Phase 1 chat is built and enabled.** Private sellers have no other contact channel, so client listings
   cannot launch without chat.
2. **Security fixes merged** (raised as separate tasks during the brainstorm):
   - `PATCH /api/properties/[id]/restart`, `/api/properties/[id]/featured`, and `POST /api/properties/[id]/clone`
     do not check ownership: any logged-in user can bump or clone any property and spend any agency's
     credits (`featured` even takes `agencyId` from the request body).
   - `DELETE /api/clients/[id]` does not check that the caller owns the account being deleted.
   Phase 2 opens property management to every client account, so these must be fixed first.
3. **Chat schema already supports Phase 2 and 3.** `ConversationKind.PRIVATE_INQUIRY` (client → private
   seller) and `AGENCY_OUTREACH` (agency → opted-in seller) exist from Phase 1; the participant model is
   person-or-agency on each side and `dedupeKey` enforces one thread per pair per property. No chat
   migration should be needed; Phase 2/3 only add new `kind` handling and entry points.
4. **Messaging safety rules from Phase 1 carry over:** unverified senders are held for admin review, the
   10-unanswered-messages flag, per-IP account creation limit (3/day), block/report, admin oversight.

---

## Phase 2 — agreed decisions

### Publishing
- Clients (role `CLIENT`) can publish properties into the existing `Property` model. Lowest-effort
  approach: reuse `Property`, add a client-owner relation, keep `agencyId` null.
- The admin approval flow is identical for agency and client listings.
- The public UI stays exactly the same. Where the agency logo appears (property card
  `src/components/elements/property_card/property_card.jsx`, map card `map_property_card.jsx`, property
  details sidebar), show a lucide user icon placeholder instead.
- The create/edit form reuses `src/components/modules/dashboard/property/property.jsx`, tweaked for
  clients: hide agency-only sections (owner/renter CRM `PropertyOwnerRenter`, agency verification,
  Facebook publication, Hommex publication, client-preference match modal, internal `externalId`).

### Contact
- **No phone number is ever shown for private sellers.** Contact is chat only
  (`PRIVATE_INQUIRY`). Sellers can share their number inside the chat if they choose. Reason: a visible
  phone lets agencies bypass the chat and call sellers directly.
- Only users with an account can contact a private seller (the Phase 1 guest flow creates the account
  automatically, which also brings in new users).
- The Phase 1 contact-preference idea (phone / messages / both on the `Client` model) was dropped because
  of the rule above.

### Credits
- Every new client gets **150 credits** at signup. A one-off script grants existing clients the same.
- The grant ships with Phase 2, behind `CLIENT_LISTINGS_ENABLED`.
- Clients spend credits at the same prices as agencies: renew 10, featured 180
  (`src/constants/pricing_credits.js`). 150 < 180, so free credits alone cannot buy a featured spot.
- No "buy more credits" UI for clients for now.

### Client dashboard
- New sections: create/edit property; a listing page (reuse the agency listing UI or a simpler variant)
  with filters; analytics for their own listings (take the relevant parts of the agency analytics at
  `src/app/[locale]/(dashboard)/smetka/agencija/prodazba/analitika/`).
- Listing actions: everything an agent can do where it makes sense — edit, delete, renew, clone, and
  others to be decided in the Phase 2 brainstorm.

### Lifecycle and flag
- `CLIENT_LISTINGS_ENABLED` off: client listings are hidden from every public surface (search, map,
  details page 404, sitemap, similar listings, landings), dashboard sections are hidden, APIs return 404.
- Deleting a client account soft-deletes their listings with an "account deleted" reason (like agencies),
  and the Phase 1 chat handling keeps agencies' conversation history.

---

## Phase 3 — agreed decisions

- Each client listing has an **"Open to agency collaboration"** checkbox, **checked by default**, on create
  and edit.
- A new agency dashboard section lists opted-in private listings with filters; the agency contacts the
  seller through chat (`AGENCY_OUTREACH`). No copying or hand-over of the property.
- Agencies **cannot contact a private seller who has not opted in, through any channel, including the
  buyer chat on the property page.**
- **One conversation per agency per listing.**
- **Anti-spam lock, same model as leads:** when 3 distinct agencies have started a conversation the
  section shows "already contacted by several agencies"; at 5 the listing is locked for further agencies.
  The lock lasts for the listing's lifetime; a blocked agency keeps its slot.
- The seller can switch the opt-in off at any time and can block or mute an agency.
- Agency members see which colleague already contacted a listing (no double contact).
- The seller's inbox labels agency threads separately from buyer threads.
- **Pricing:** free for all agencies at launch (to promote it), behind a new entitlement key in
  `src/lib/entitlements/agency_entitlement_keys.js`. Later it follows the lead-unlock model: premium plans
  unlimited, other plans one free contact per month, then 100 credits each (see `LeadReveal` /
  `LeadUnlockType` in `prisma/schema/misc.prisma` for the existing pattern).

---

## Code findings that affect Phase 2 and 3

| Finding | Where |
|---------|-------|
| `Property.agencyId` is already nullable, and public queries already keep agency-less rows | `src/constants/hidden_agencies.js` (`VISIBLE_AGENCY_PROPERTY_WHERE`) |
| Property details page returns 404 without an agency; sidebar, contact form, mobile bar, rating, "Imotko approved", and agency showcase all assume an agency | `src/app/[locale]/(public)/nedviznini/[slug]/[id]/page.jsx:202` |
| `POST /api/properties` assumes `userWithAgency.agency.id` and an `AgencyMember` | `src/app/api/properties/route.js` |
| `canManageProperty` returns false when `agencyId` is null | `src/utils/api_utils/property.js:73` |
| Renew and featured charge **agency** credits; clients need a client-credits path | `src/app/api/properties/[id]/restart/route.js`, `featured/route.js` |
| Clone copies the source `agencyId` | `src/app/api/properties/[id]/clone/route.js` |
| `PropertySale.agencyId` is required, so "mark as sold" on delete breaks for clients | `prisma/schema/property.prisma` |
| JSON-LD names the agency as seller | `src/lib/structured_schemas/structured_schemas.js:592` |
| `Property.ownerId` / `owner` already means the agency CRM `AgencyClient`; the client-owner field needs a different name | `prisma/schema/property.prisma` |
| `User.role` is single-valued and `/korisnicka-smetka` is CLIENT-only; agency users cannot list privately | `prisma/schema/user.prisma`, `src/proxy.js` |
| The current client page "sell your property" collects a SELLING **lead** that agencies pay 100 credits to unlock; free agency access to opted-in sellers (Phase 3) competes with that revenue | `src/app/[locale]/(client-account)/korisnicka-smetka/nedviznosti/page.jsx`, `src/components/modules/gather_leads/gather_leads.jsx` |
| The estimations flow (`Proposal` → `ProposalOffer` → `ProposalCollaboration`) is an existing "client posts, agencies offer" pattern | `prisma/schema/proposal.prisma`, `/korisnicka-smetka/procenki` |
| Facebook and Hommex publication are agency-only and must stay off for client listings | `src/app/api/properties/route.js` |
| Agency contact emails currently go to `contact@imotko.mk`, not to agencies | `src/actions/email.js` (`sendAgencyContactEmail`) |
| Upload watermarking, saved-search subscription emails, sitemap, landings, `llms.txt`, similar properties, and price trends all read properties and need a decision for client listings | various |

---

## Open questions for the Phase 2 brainstorm

1. Client-owner relation: `Property → Client` or `Property → User`, and its field name (not `ownerId`).
2. What identity is shown publicly on a private listing: "Private seller" label only, or first name too?
3. Limits on active listings per client, and how to spot agencies posing as private owners.
4. Exactly which agency actions clients get: renew, featured, clone, hide/show, auto-renew, mark as sold.
5. What happens to the current "sell your property" lead page: replace it, or keep the lead form as an
   extra "let agencies help you" call to action?
6. Structured data for private listings: `Person` seller, or omit the seller.
7. Do client listings trigger saved-search subscription emails? (Facebook and Hommex: no.)
8. Client analytics scope (views over time, favorites, shares, message count).
9. Renewal and expiry rules for client listings.
10. Where clients see their credit balance; whether credit transactions need a log.
11. Admin approval queue: badge or filter for private vs agency listings.
12. Seller identity in chat threads with buyers (display name rules for `PRIVATE_INQUIRY`).

## Open questions for the Phase 3 brainstorm

1. Entitlement key name and how the future free-per-month allowance is counted.
2. Storage for the 3/5 contact counter: count `AGENCY_OUTREACH` conversations per property, or a
   `LeadReveal`-style table with `@@unique([agencyId, propertyId])`.
3. What the seller sees about how many agencies contacted them, and whether turning the opt-in off and on
   again changes anything (Phase 3 decision so far: the lock is lifetime).
4. Filters and sorting in the agency section, and whether locked listings stay visible.
5. Whether the agency section shows listings before they are approved (assumed: approved only).
