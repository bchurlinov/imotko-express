import { createHmac } from "node:crypto"

const TOKEN_PURPOSE = "agency-email-unsubscribe"

/**
 * Token for the web app's agency opt-out page (/agencija/otkazi-izvestuvanja/<token>). Same format as imotko's
 * src/lib/email/agency_email_unsubscribe.js: base64url(agencyId).base64url(hmac). The web app verifies it with
 * EMAIL_UNSUBSCRIBE_SECRET, which both apps share; the web's AUTH_SECRET never leaves Vercel.
 *
 * @param {string} agencyId
 * @param {string} [secret]
 * @returns {string | null} null without a secret or agency id
 */
export const createAgencyEmailUnsubscribeToken = (agencyId, secret = process.env.EMAIL_UNSUBSCRIBE_SECRET) => {
    if (!agencyId || !secret) return null

    const signature = createHmac("sha256", secret).update(`${TOKEN_PURPOSE}:${agencyId}`).digest()
    return `${Buffer.from(agencyId).toString("base64url")}.${signature.toString("base64url")}`
}
