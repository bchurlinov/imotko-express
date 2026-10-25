import { createHash } from "node:crypto"

/**
 * Redis layout shared by the API (producer, status endpoint) and the bulk email worker.
 *
 * One campaign = one admin "Send" on imotko's /smetka/admin/emails. Its subject and rendered body live once in a
 * hash; each recipient is a BullMQ job that only carries the address and its opt-out link.
 *
 * @module workers/bulk-email/campaign_store
 */

export const BULK_EMAIL_QUEUE_NAME = "bulk-admin-email"
export const BULK_EMAIL_JOB_NAME = "send-bulk-admin-email"
export const CAMPAIGN_TTL_SECONDS = 7 * 24 * 60 * 60
export const FAILED_EMAILS_LIMIT = 200

export const campaignKey = campaignId => `bulk-email:campaign:${campaignId}`
export const claimKey = campaignId => `${campaignKey(campaignId)}:claim`
export const failedKey = campaignId => `${campaignKey(campaignId)}:failed`

/**
 * One job per campaign and address, so the same campaign can never queue an address twice. The address is hashed so
 * it does not show up in job ids (logs, Redis key names).
 *
 * @param {{ campaignId: string, email: string }} job
 * @returns {string}
 */
export const getBulkEmailJobId = ({ campaignId, email }) =>
    `bulk-email-${campaignId}-${createHash("sha256").update(email).digest("hex").slice(0, 16)}`

const toCount = value => Number.parseInt(value, 10) || 0

/**
 * @param {import('ioredis').default} redis
 * @param {string} campaignId
 * @returns {Promise<{ subject: string, html: string, replyTo: string, deliveryMode: string } | null>}
 */
export const readCampaign = async (redis, campaignId) => {
    const campaign = await redis.hgetall(campaignKey(campaignId))
    return campaign?.subject ? campaign : null
}

/**
 * @param {import('ioredis').default} redis
 * @param {string} campaignId
 * @returns {Promise<{ campaignId: string, total: number, sent: number, failed: number, excluded: number,
 *   failedEmails: string[], done: boolean, createdAt: string } | null>} null when unknown or expired
 */
export const readCampaignStatus = async (redis, campaignId) => {
    const campaign = await readCampaign(redis, campaignId)
    if (!campaign) return null

    const [total, sent, failed] = [toCount(campaign.total), toCount(campaign.sent), toCount(campaign.failed)]
    return {
        campaignId,
        total,
        sent,
        failed,
        excluded: toCount(campaign.excluded),
        failedEmails: await redis.lrange(failedKey(campaignId), 0, FAILED_EMAILS_LIMIT - 1),
        done: sent + failed >= total,
        createdAt: campaign.createdAt,
    }
}

// HINCRBY on an expired key would recreate it without a TTL, so late results for a gone campaign are dropped
const campaignExists = async (redis, campaignId) => (await redis.exists(campaignKey(campaignId))) === 1

export const recordSent = async (redis, campaignId) => {
    if (!(await campaignExists(redis, campaignId))) return
    await redis.multi().hincrby(campaignKey(campaignId), "sent", 1).exec()
}

export const recordFailed = async (redis, campaignId, email) => {
    if (!(await campaignExists(redis, campaignId))) return
    await redis
        .multi()
        .hincrby(campaignKey(campaignId), "failed", 1)
        .rpush(failedKey(campaignId), email)
        .ltrim(failedKey(campaignId), 0, FAILED_EMAILS_LIMIT - 1)
        .expire(failedKey(campaignId), CAMPAIGN_TTL_SECONDS)
        .exec()
}
