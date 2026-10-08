// COPIED FROM imotko/src/lib/client_listings/permissions.js by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).
import { PropertyStatus, UserRole } from "#generated/prisma/enums.ts"

export const canClientManageProperty = (sessionUser, clientId, property) =>
    sessionUser?.role === UserRole.CLIENT &&
    Boolean(clientId) &&
    Boolean(property?.clientId) &&
    property.clientId === clientId &&
    property.status !== PropertyStatus.DELETED

// Not found and not owned answer the same, so ids of other people's listings cannot be probed.
export const loadOwnedProperty = async (db, { sessionUser, clientId, propertyId, select = {} }) => {
    if (!propertyId) return null
    const property = await db.property.findUnique({
        where: { id: String(propertyId) },
        select: { ...select, id: true, clientId: true, status: true },
    })
    return canClientManageProperty(sessionUser, clientId, property) ? property : null
}
