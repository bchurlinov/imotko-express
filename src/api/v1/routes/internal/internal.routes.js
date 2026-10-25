import { timingSafeEqual } from "node:crypto"
import express from "express"
import { invalidateCachePattern } from "#utils/cache/invalidation.js"
import { isTrustedInternalCaller } from "#middlewares/rateLimitKey.js"
import {
    enqueueFacebookPublication,
    parseFacebookPublicationRequest,
} from "#services/properties/facebook_publication_queue.service.js"
import {
    parseBulkEmailRequest,
    renderBulkEmailHtml,
    sanitizeBulkEmailMessage,
} from "#services/email/bulk_email_request.js"
import { resolveBulkEmailRecipients } from "#services/email/bulk_email_recipients.service.js"
import { getBulkEmailCampaignStatus, queueBulkEmailCampaign } from "#services/email/bulk_email_queue.service.js"

const router = express.Router()

export const isValidRevalidateSecret = (provided, expected) => {
    if (!provided || !expected) return false
    const a = Buffer.from(provided)
    const b = Buffer.from(expected)
    return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Called by imotko (Next) after it writes agency website data directly to the DB,
 * so the in-memory getAgencyByReferer cache doesn't serve the old config to the templates refetch.
 */
router.post("/agency-cache/invalidate", (req, res) => {
    if (!isValidRevalidateSecret(req.get("x-revalidate-secret"), process.env.REVALIDATE_SECRET)) {
        return res.status(401).json({ message: "Unauthorized" })
    }
    invalidateCachePattern("cache:getAgencyByReferer:")
    return res.status(204).end()
})

/**
 * Handler for imotko (Next) asking for a Facebook publication job after a property save.
 * Authenticated with INTERNAL_API_SECRET, which only our own servers have; with it unset every call is rejected.
 * The job id is per property revision, so a retried call does not publish twice.
 *
 * @param {{ enqueue?: typeof enqueueFacebookPublication, isTrusted?: typeof isTrustedInternalCaller }} [deps]
 * @returns {import('express').RequestHandler}
 */
export const createFacebookPublicationHandler =
    ({ enqueue = enqueueFacebookPublication, isTrusted = isTrustedInternalCaller } = {}) =>
    async (req, res) => {
        if (!isTrusted(req)) return res.status(401).json({ message: "Unauthorized" })

        const request = parseFacebookPublicationRequest(req.body)
        if (!request) return res.status(400).json({ message: "Invalid request" })

        try {
            const job = await enqueue(request)
            return res.status(202).json({ jobId: job?.id ?? null })
        } catch (error) {
            console.error("[facebookPublication] enqueue failed", request.propertyId, error?.message || error)
            return res.status(503).json({ message: "Queue unavailable" })
        }
    }

router.post("/facebook-publication", createFacebookPublicationHandler())

const CUSTOM_RECIPIENT_MODE = "custom"
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const webAppUrl = () => (process.env.IMOTKO_WEB_URL || "https://imotko.mk").replace(/\/$/, "")

/**
 * Handler for imotko's admin "Send emails" page (/smetka/admin/emails). The admin session is checked on the web side;
 * here the caller must hold INTERNAL_API_SECRET. The send itself runs in the bulk email worker.
 *
 * @param {{ isTrusted?: typeof isTrustedInternalCaller, resolveRecipients?: (emails: string[]) =>
 *   ReturnType<typeof resolveBulkEmailRecipients>, queueCampaign?: typeof queueBulkEmailCampaign }} [deps]
 * @returns {import('express').RequestHandler}
 */
export const createBulkEmailHandler =
    ({
        isTrusted = isTrustedInternalCaller,
        resolveRecipients = emails => resolveBulkEmailRecipients(emails, { appUrl: webAppUrl() }),
        queueCampaign = queueBulkEmailCampaign,
    } = {}) =>
    async (req, res) => {
        if (!isTrusted(req)) return res.status(401).json({ message: "Unauthorized" })

        const parsed = parseBulkEmailRequest(req.body)
        if (!parsed.ok) {
            const { ok, ...error } = parsed
            return res.status(400).json(error)
        }
        const { request } = parsed

        let recipients
        let excluded = []
        try {
            // Custom addresses go out as typed; everything else is re-checked against opt-outs
            ;({ recipients, excluded } =
                request.recipientMode === CUSTOM_RECIPIENT_MODE
                    ? { recipients: request.recipients.map(email => ({ email, unsubscribeLink: "" })), excluded: [] }
                    : await resolveRecipients(request.recipients))
        } catch (error) {
            console.error("[bulkEmail] recipient lookup failed", request.campaignId, error?.message || error)
            return res.status(503).json({ message: "Recipient lookup unavailable" })
        }

        // Test campaigns go to the dev inbox; a real user's working opt-out link must not end up there
        if (request.deliveryMode !== "real") {
            recipients = recipients.map(({ email }) => ({ email, unsubscribeLink: "" }))
        }

        if (!recipients.length) {
            return res.status(422).json({
                message: `No recipients left: ${excluded.length} opted out of emails.`,
                excluded: excluded.length,
            })
        }

        try {
            const result = await queueCampaign({
                campaignId: request.campaignId,
                subject: request.subject,
                html: renderBulkEmailHtml({ title: request.subject, content: sanitizeBulkEmailMessage(request.message) }),
                replyTo: request.replyTo,
                deliveryMode: request.deliveryMode,
                recipients,
                excluded: excluded.length,
            })
            console.info("[bulkEmail] campaign queued", {
                campaignId: request.campaignId,
                recipientMode: request.recipientMode,
                queued: result.queued,
                excluded: result.excluded,
                duplicate: result.duplicate,
            })
            return res.status(202).json(result)
        } catch (error) {
            if (error?.code === "CAMPAIGN_PENDING") {
                return res.status(409).json({ message: "This campaign is still being queued. Try again in a minute." })
            }
            console.error("[bulkEmail] queue failed", request.campaignId, error?.message || error)
            return res.status(503).json({ message: "Queue unavailable" })
        }
    }

/**
 * Progress of a campaign for the admin page, which polls it every few seconds.
 * @param {{ isTrusted?: typeof isTrustedInternalCaller, getStatus?: typeof getBulkEmailCampaignStatus }} [deps]
 * @returns {import('express').RequestHandler}
 */
export const createBulkEmailStatusHandler =
    ({ isTrusted = isTrustedInternalCaller, getStatus = getBulkEmailCampaignStatus } = {}) =>
    async (req, res) => {
        if (!isTrusted(req)) return res.status(401).json({ message: "Unauthorized" })

        const campaignId = req.params?.campaignId
        if (!UUID_PATTERN.test(campaignId || "")) return res.status(400).json({ message: "Invalid campaign id" })

        try {
            const status = await getStatus(campaignId)
            if (!status) return res.status(404).json({ message: "Campaign not found" })
            return res.status(200).json(status)
        } catch (error) {
            console.error("[bulkEmail] status failed", campaignId, error?.message || error)
            return res.status(503).json({ message: "Queue unavailable" })
        }
    }

router.post("/bulk-email", createBulkEmailHandler())
router.get("/bulk-email/:campaignId", createBulkEmailStatusHandler())

export default router
