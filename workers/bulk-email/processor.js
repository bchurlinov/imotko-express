import { UnrecoverableError } from "bullmq"
import { appendImotkoEmailFooter } from "#utils/email/email_footer.js"
import { resolveEmailDelivery } from "#utils/email/delivery_policy.js"
import { inlineHostedImages } from "#utils/email/inline_images.js"
import { buildRawEmail } from "#utils/email/raw_mime.js"
import { chatLocaleText } from "#services/chat/chat_locales.js"
import { readCampaign, recordSent } from "./campaign_store.js"

// The admin page only sends Macedonian emails, so the opt-out line is Macedonian too (same copy as the web app)
const UNSUBSCRIBE_LOCALE = "mk"

/**
 * SES answers "Throttling: Maximum sending rate exceeded." when the account's per-second limit is hit, e.g. while the
 * web app's own bulk sends overlap with this worker.
 *
 * @param {unknown} error
 * @returns {boolean}
 */
export const isSesThrottle = error =>
    error?.name === "Throttling" || /maximum sending rate exceeded/i.test(error?.message || "")

/**
 * Sends one email of a campaign: the stored body + the Imotko footer with this recipient's opt-out line, logo and
 * store icons inlined as cid: parts (same as the web app's emails).
 *
 * @param {{ redis: import('ioredis').default, sendRawEmail: (message: { raw: string, destinations: string[],
 *   from: string }) => Promise<unknown>, from: string, env?: NodeJS.ProcessEnv,
 *   onThrottle: () => Promise<never> }} deps
 * @returns {(job: import('bullmq').Job) => Promise<void>}
 */
export const createBulkEmailProcessor =
    ({ redis, sendRawEmail, from, env = process.env, onThrottle }) =>
    async job => {
        const { campaignId, email, unsubscribeLink } = job.data
        const campaign = await readCampaign(redis, campaignId)
        // Expired (7 days) or never stored: nothing to send, and retrying will not bring it back
        if (!campaign) throw new UnrecoverableError("campaign-expired")

        // A campaign queued from a Preview/local web app must never reach real inboxes, whatever this worker runs as
        const deliveryEnv = campaign.deliveryMode === "real" ? env : { ENV: "development" }
        const delivery = resolveEmailDelivery({ to: email, replyTo: campaign.replyTo, subject: campaign.subject }, deliveryEnv)

        const unsubscribe = unsubscribeLink
            ? {
                  text: chatLocaleText(UNSUBSCRIBE_LOCALE, "emailImotkoUnsubscribeText"),
                  label: chatLocaleText(UNSUBSCRIBE_LOCALE, "emailImotkoUnsubscribeLabel"),
                  link: unsubscribeLink,
              }
            : undefined
        const { html, inlineImages } = inlineHostedImages(appendImotkoEmailFooter(campaign.html, { unsubscribe }))
        const raw = buildRawEmail({
            from,
            to: delivery.toAddresses,
            replyTo: delivery.replyToAddresses ?? [],
            subject: delivery.subject,
            html,
            inlineImages,
        })

        try {
            await sendRawEmail({ raw, destinations: delivery.toAddresses, from })
        } catch (error) {
            if (isSesThrottle(error)) await onThrottle()
            throw error
        }

        // The email is out; a lost counter update must not make BullMQ retry (and send it again)
        await recordSent(redis, campaignId).catch(() => {})
    }
