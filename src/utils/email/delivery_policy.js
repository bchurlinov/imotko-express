// Mirrors imotko web `src/lib/email/delivery_policy.js`: outside production every email goes to the approved inboxes,
// so local and stage runs never reach real users or agencies.
const DEVELOPMENT_EMAIL_RECIPIENTS = Object.freeze(["bchurlinov@gmail.com"])
const DEVELOPMENT_REPLY_TO = Object.freeze(["bojan@imotko.mk"])

const normalizeAddresses = addresses => {
    const unique = new Map()
    ;(Array.isArray(addresses) ? addresses : [addresses]).forEach(address => {
        if (typeof address !== "string") return
        const trimmed = address.trim()
        if (trimmed && !unique.has(trimmed.toLowerCase())) unique.set(trimmed.toLowerCase(), trimmed)
    })
    return [...unique.values()]
}

// NODE_ENV is accepted too, same as cors.config.js, so a production host that only sets NODE_ENV keeps real delivery.
export const isRealEmailDeliveryEnabled = (env = process.env) =>
    env.ENV === "production" || env.NODE_ENV === "production"

export const resolveEmailDelivery = ({ to, replyTo, subject }, env = process.env) => {
    const redirected = !isRealEmailDeliveryEnabled(env)
    const toAddresses = redirected ? [...DEVELOPMENT_EMAIL_RECIPIENTS] : normalizeAddresses(to)
    if (!toAddresses.length) throw new Error("Email delivery requires at least one recipient.")

    const replyToAddresses = redirected ? [...DEVELOPMENT_REPLY_TO] : normalizeAddresses(replyTo)
    return {
        redirected,
        toAddresses,
        replyToAddresses: replyToAddresses.length ? replyToAddresses : undefined,
        subject:
            redirected && typeof subject === "string" && !subject.startsWith("[DEV]") ? `[DEV] ${subject}` : subject,
    }
}
