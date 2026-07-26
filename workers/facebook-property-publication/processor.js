import { UnrecoverableError } from "bullmq"
import { FacebookApiError, MetaCryptoError } from "./errors.js"
import { evaluatePublicationEligibility, isPublicationGuardCurrent } from "./eligibility.js"
import { buildPropertyMessage, selectLargePhotoUrls } from "./message.js"

const validId = value => typeof value === "string" && value.trim().length > 0

const connectionStatuses = new Set(["ERROR", "EXPIRED", "REVOKED"])

const persistenceSucceeded = outcome => ["recorded", "already-recorded", "deleted"].includes(outcome)

export function createFacebookPropertyProcessor({
    repository,
    facebookClient,
    decryptToken,
    tokenEncryptionKey,
    publicAppUrl,
    logger,
    now = () => new Date(),
}) {
    const log = (level, event, metadata) => {
        try {
            logger?.[level]?.(event, metadata)
        } catch {
            // Logging must never turn completed or permanent work into a retry.
        }
    }

    const invalidateConnection = async (connection, status, errorCode, errorAt) => {
        await repository.invalidateConnection({
            connectionId: connection.id,
            revision: connection.revision,
            status,
            errorCode,
            errorAt,
        })
        log("info", "facebook_connection_invalidated", { connectionId: connection.id, status, errorCode })
    }

    return async job => {
        if (job?.name !== "publish-approved-property") {
            throw new UnrecoverableError("Unsupported Facebook publication job")
        }

        const { propertyId, agencyId } = job.data || {}
        if (!validId(propertyId) || !validId(agencyId)) {
            throw new UnrecoverableError("Invalid Facebook publication job identifiers")
        }

        log("info", "facebook_job_started", {
            jobId: job.id,
            jobName: job.name,
            propertyId,
            agencyId,
            attempt: job.attemptsMade + 1,
        })

        const property = await repository.loadProperty(propertyId)
        const checkedAt = now()
        const eligibility = evaluatePublicationEligibility(property, agencyId, checkedAt)

        if (!eligibility.eligible) {
            const connection = property?.agency?.facebookConnection
            if (eligibility.connectionStatus && connection) {
                await invalidateConnection(connection, eligibility.connectionStatus, eligibility.errorCode, checkedAt)
            }
            log("info", "facebook_job_skipped", {
                jobId: job.id,
                propertyId,
                agencyId,
                reason: eligibility.reason,
            })
            return { skipped: true, reason: eligibility.reason, propertyId }
        }

        let message
        try {
            message = buildPropertyMessage(property, publicAppUrl)
        } catch {
            log("info", "facebook_job_skipped", {
                jobId: job.id,
                propertyId,
                agencyId,
                reason: "invalid-facebook-content",
            })
            return { skipped: true, reason: "invalid-facebook-content", propertyId }
        }

        const connection = property.agency.facebookConnection
        let accessToken
        try {
            accessToken = decryptToken(connection.encryptedPageToken, tokenEncryptionKey)
        } catch (error) {
            if (!(error instanceof MetaCryptoError)) throw error
            await invalidateConnection(connection, "ERROR", "token-decryption-failed", checkedAt)
            throw new UnrecoverableError("Stored Facebook Page token cannot be decrypted")
        }

        const photoIds = []
        try {
            for (const [index, imageUrl] of selectLargePhotoUrls(property.photos).entries()) {
                const photoId = await facebookClient.uploadUnpublishedPhoto({
                    pageId: connection.pageId,
                    imageUrl,
                    accessToken,
                })
                photoIds.push(photoId)
                log("info", "facebook_photo_uploaded", {
                    jobId: job.id,
                    propertyId,
                    agencyId,
                    photoIndex: index,
                })
            }

            const guard = await repository.loadPublicationGuard(propertyId)
            if (!isPublicationGuardCurrent(connection, guard, agencyId, now())) {
                log("info", "facebook_job_skipped", {
                    jobId: job.id,
                    propertyId,
                    agencyId,
                    reason: "publication-guard-changed",
                })
                return { skipped: true, reason: "publication-guard-changed", propertyId }
            }

            const facebookPostId = await facebookClient.createPagePost({
                pageId: connection.pageId,
                message,
                photoIds,
                accessToken,
            })
            const publishedAt = now()
            const persistence = await repository.recordPublished(propertyId, publishedAt)

            if (!persistenceSucceeded(persistence?.outcome)) {
                throw new Error("Facebook publication timestamp was not recorded")
            }

            if (persistence.outcome === "deleted") {
                log("error", "published-untracked", {
                    jobId: job.id,
                    propertyId,
                    agencyId,
                    facebookPostId,
                    persistenceOutcome: "deleted",
                })
            }
            log("info", "facebook_post_published", {
                jobId: job.id,
                propertyId,
                agencyId,
                facebookPostId,
                persistenceOutcome: persistence.outcome,
            })
            return { published: true, propertyId, facebookPostId }
        } catch (error) {
            if (error instanceof FacebookApiError) {
                const status = connectionStatuses.has(error.connectionStatus) ? error.connectionStatus : "ERROR"
                const errorCode = error.errorCode || "facebook-authorization-failed"
                await invalidateConnection(connection, status, errorCode, now())
                log("error", "facebook_job_failed", {
                    jobId: job.id,
                    jobName: job.name,
                    propertyId,
                    agencyId,
                    attempt: job.attemptsMade + 1,
                    errorCode,
                    metaCode: error.metaCode,
                    metaSubcode: error.metaSubcode,
                    fbtraceId: error.fbtraceId,
                })
                throw new UnrecoverableError("Facebook Page authorization no longer permits publishing")
            }
            throw error
        } finally {
            accessToken = null
        }
    }
}
