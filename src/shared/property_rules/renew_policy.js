// COPIED FROM imotko/src/lib/client_listings/renew_policy.js by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).
import { PropertyStatus } from "#generated/prisma/enums.ts"
import { SKOPJE_TIME_ZONE, getStartOfDayInTimeZone, getTimeZoneParts } from "./time_zone.js"

// A listing is renewed at most once per calendar day, counted from 00:00 Europe/Skopje, summer and winter time alike.
export const getRenewDayStart = (now = new Date()) =>
    getStartOfDayInTimeZone(getTimeZoneParts(now, SKOPJE_TIME_ZONE), SKOPJE_TIME_ZONE)

export const canRenewToday = (bumpedAt, now = new Date()) => !bumpedAt || new Date(bumpedAt) < getRenewDayStart(now)

// The day check is part of the UPDATE, so parallel requests cannot renew the same listing twice.
// Resolves to false when the listing was already renewed today (or is not a published listing of this client).
export const renewPropertyOncePerDay = async (db, { propertyId, clientId, now = new Date() }) => {
    const { count } = await db.property.updateMany({
        where: {
            id: propertyId,
            clientId,
            status: PropertyStatus.PUBLISHED,
            OR: [{ bumpedAt: null }, { bumpedAt: { lt: getRenewDayStart(now) } }],
        },
        data: { bumpedAt: now, updatedAt: now },
    })
    return count > 0
}
