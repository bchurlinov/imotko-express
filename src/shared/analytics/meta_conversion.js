// COPIED FROM imotko/src/lib/analytics/meta_conversion.js by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).
import { createHash } from "node:crypto"
import { captureServerEvent } from "#shared/ai/posthog_server.js"

// Server-side Meta conversions go out as PostHog events carrying the Meta fields; PostHog's "Meta Ads Conversions"
// destination forwards them to the Conversions API. Shared with imotko-express by scripts/export_property_rules.mjs.
export const hashForMeta = value => {
    const normalized = String(value ?? "")
        .trim()
        .toLowerCase()
    return normalized ? createHash("sha256").update(normalized).digest("hex") : null
}

// Meta's click id cookie wins; otherwise the format is fb.<subdomain index>.<click time ms>.<fbclid>.
export const buildFbc = ({ fbcCookie, fbclid, now = Date.now() } = {}) => {
    if (fbcCookie) return fbcCookie
    return fbclid ? `fb.1.${now}.${fbclid}` : null
}

const compact = object => Object.fromEntries(Object.entries(object).filter(([, value]) => value != null))

export const captureMetaConversion = ({
    distinctId,
    event,
    metaEventName,
    metaEventId,
    actionSource,
    user,
    requestContext = null,
    customData = {},
}) => {
    const person = compact({ meta_fbp: requestContext?.fbp, meta_fbc: requestContext?.fbc })

    captureServerEvent({
        distinctId,
        event,
        properties: compact({
            ...customData,
            meta_event_name: metaEventName,
            meta_event_id: metaEventId,
            meta_action_source: actionSource,
            meta_em: hashForMeta(user?.email),
            meta_external_id: hashForMeta(user?.id),
            ...person,
            meta_client_ip_address: requestContext?.clientIpAddress,
            meta_client_user_agent: requestContext?.clientUserAgent,
            meta_event_source_url: requestContext?.eventSourceUrl,
            $set: Object.keys(person).length ? person : null,
            $set_once: Object.keys(person).length
                ? Object.fromEntries(Object.entries(person).map(([key, value]) => [`initial_${key}`, value]))
                : null,
        }),
    })
}
