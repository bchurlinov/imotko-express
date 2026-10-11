const TIMEOUT_MS = 2000
const LOCAL_HOSTS = ["localhost", "127.0.0.1"]

// Loaded lazily so unit tests (and callers that never notify) don't initialise the database client.
const getWebsiteUrlFromDb = async agencyId => {
    const { default: prisma } = await import("#database/client.js")
    const settings = await prisma.agencyWebsiteSettings.findUnique({
        where: { agencyId },
        select: { websiteUrl: true },
    })
    return settings?.websiteUrl ?? null
}

/**
 * The revalidate endpoint on an agency's own website, or null when the address is unusable.
 * The secret is sent to this host, so it must be https (plain http only for local development).
 * @param {unknown} websiteUrl - AgencyWebsiteSettings.websiteUrl
 * @returns {string | null}
 */
export const buildRevalidateUrl = websiteUrl => {
    if (typeof websiteUrl !== "string" || !websiteUrl) return null

    let url
    try {
        url = new URL(websiteUrl)
    } catch {
        return null
    }

    const isSecure = url.protocol === "https:"
    const isLocal = url.protocol === "http:" && LOCAL_HOSTS.includes(url.hostname)
    return isSecure || isLocal ? `${url.origin}/api/revalidate` : null
}

/**
 * Tells the agency's website (imotko-templates) to drop cached data after a write.
 * The target is the agency's own `AgencyWebsiteSettings.websiteUrl`: every agency domain is served by the same
 * templates project, so one call to that agency's domain clears the shared tag cache.
 * Fire-and-forget: never throws, so callers use `void notifyTemplates(...)` after the DB write.
 * Same contract as imotko/src/lib/templates_revalidation.js (shared property_rules code imports it by alias).
 *
 * @param {{ agencyId?: string | null, propertyId?: string, scope?: "property" | "agency" }} payload
 */
export async function notifyTemplates(
    { agencyId, propertyId, scope } = {},
    { fetchImpl = fetch, env = process.env, getWebsiteUrl = getWebsiteUrlFromDb } = {}
) {
    const secret = env.REVALIDATE_SECRET
    if (!agencyId || !secret) return

    let revalidateUrl
    try {
        revalidateUrl = buildRevalidateUrl(await getWebsiteUrl(agencyId))
    } catch (error) {
        console.error("[notifyTemplates] website lookup failed", agencyId, error?.message)
        return
    }
    if (!revalidateUrl) return

    try {
        const res = await fetchImpl(revalidateUrl, {
            method: "POST",
            headers: { "content-type": "application/json", "x-revalidate-secret": secret },
            body: JSON.stringify({
                agencyId,
                ...(propertyId ? { propertyId: String(propertyId) } : {}),
                ...(scope ? { scope } : {}),
            }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        })
        if (!res.ok) console.error("[notifyTemplates] non-OK response", res.status)
    } catch (error) {
        console.error("[notifyTemplates] request failed", error?.message)
    }
}
