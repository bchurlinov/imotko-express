import { normalizeUrl } from "#utils/url/normalizeUrl.js"
import { SendEmailCommand, SendRawEmailCommand, SESClient } from "@aws-sdk/client-ses"
import {
    logAccessDenied,
    logAgencyNotFound,
    logDevBypass,
    logMalformedUrl,
    logMissingReferer,
    logOriginMismatch,
} from "#utils/logger/securityLogger.js"
import {
    ErrorResponses,
    getAgencyByReferer,
    isAllowedReferrer,
    validateOriginRefererMatch,
    isDevelopmentBypass,
} from "./utils/index.js"
import { createContactEmailTemplate } from "./templates/contact_email_template.js"
import prisma from "#database/client.js"

/**
 * Main service function to get agency website configuration with full authorization
 *
 * @param {string|undefined} referer - The referer header value
 * @param {string|undefined} origin - The origin header value
 * @param {string|undefined} userAgent - The user-agent header value
 * @param {string|undefined} ip - Client IP address for logging
 * @returns {Promise<{success: boolean, data?: Object, error?: {code: number, message: string}}>}
 *
 * @example
 * const result = await getAgencyWebsiteConfiguration(referer, origin, userAgent, ip);
 * if (result.success) {
 *   console.log(result.data); // Agency data
 * } else {
 *   console.log(result.error); // { code: 403, message: 'forbiddenReferer' }
 * }
 */
export async function getAgencyWebsiteConfiguration(referer, origin, userAgent, ip) {
    try {
        // Step 1: Check if referer header exists
        if (!referer) {
            logMissingReferer({ ip, userAgent })
            return {
                success: false,
                error: ErrorResponses.FORBIDDEN_REFERER,
            }
        }

        // Step 2: Validate referer URL is well-formed
        const normalizedReferer = normalizeUrl(referer)
        if (!normalizedReferer) {
            logMalformedUrl({ url: referer, source: "referer" })
            logAccessDenied({ referer, origin, userAgent, ip, reason: "Malformed referer URL" })
            return {
                success: false,
                error: ErrorResponses.FORBIDDEN_REFERER,
            }
        }

        // Step 3: Validate Origin and Referer match (if both present)
        const originRefererMatch = validateOriginRefererMatch(referer, origin)
        if (!originRefererMatch) {
            logOriginMismatch({ referer, origin, ip })
            logAccessDenied({
                referer,
                origin,
                userAgent,
                ip,
                reason: "Origin and Referer headers do not match",
            })
            return {
                success: false,
                error: ErrorResponses.FORBIDDEN_REFERER,
            }
        }

        // Step 4: Check development bypass
        const devBypass = isDevelopmentBypass(userAgent)
        if (devBypass) {
            logDevBypass({ referer, userAgent })
        }

        // Step 5: Check against allowed referrers list
        const allowed = isAllowedReferrer(referer)
        if (!allowed) {
            return {
                success: false,
                data: {
                    allowed: false,
                    message: "Not allowed referrer",
                },
            }
        }

        // Step 6: Check against database agencies
        const agency = await getAgencyByReferer(referer)
        if (!agency) {
            // If development bypass is active, allow the request even without agency match
            if (devBypass) {
                return {
                    success: true,
                    data: {
                        allowed: true,
                        devBypass: true,
                        message: "Development bypass - no agency match required",
                    },
                }
            }

            logAgencyNotFound({ referer, ip })
            logAccessDenied({
                referer,
                origin,
                userAgent,
                ip,
                reason: "No agency found matching referer domain",
            })

            return {
                success: false,
                error: ErrorResponses.AGENCY_NOT_FOUND,
            }
        }

        // Step 7: Return successful result with agency data (already filtered)
        return {
            success: true,
            data: agency,
        }
    } catch (error) {
        console.error("Error in getAgencyWebsiteConfiguration:", error)
        return {
            success: false,
            error: ErrorResponses.INTERNAL_ERROR,
        }
    }
}

const domain = process.env.PUBLIC_APP_URL
const emailClient = new SESClient({
    region: process.env.AWS_SES_REGION,
    credentials: {
        accessKeyId: process.env.AWS_SES_KEY,
        secretAccessKey: process.env.AWS_SES_SECRET_KEY,
    },
})

/**
 * Service to handle agency contact form submission and send email
 * @param {Object} body - Form data from request body
 * @param {string} body.name - Contact name
 * @param {string} [body.email] - Contact email (optional)
 * @param {string} body.phone - Contact phone
 * @param {string} [body.subject] - Message subject (optional)
 * @param {string} [body.message] - Message content (optional)
 * @param {Object} [body.property] - Property object (optional)
 * @param {number} [body.property.id] - Property ID
 * @param {string} [body.property.slug] - Property slug
 * @param {string} [body.property.name] - Property name
 * @param {Object} agency - Agency data from middleware
 * @returns {Promise<{success: boolean, data?: Object, error?: {code: number, message: string}}>}
 */
export async function postAgencyContactService(body, agency) {
    try {
        if (!agency || !agency.email) {
            return {
                success: false,
                error: {
                    code: 400,
                    message: "Agency email not found",
                },
            }
        }

        let { name, email, phone, subject, message, property } = body

        // If property is provided, construct URL and extract details
        let propertyUrl = null
        let propertyId = null
        let propertyName = null
        if (property && property.id && property.slug) {
            propertyId = property.id
            propertyName = property.name || null
            if (agency.social?.website)
                propertyUrl = `${agency.social.website}/nedviznini/${property.slug}/${property.id}`
        }

        const htmlContent = createContactEmailTemplate(
            { name, email, phone, subject, message, propertyId, propertyUrl, propertyName },
            agency
        )

        console.log({ property })

        const emailSubject = subject ? `Contact Form: ${subject}` : `New Contact Form Submission from ${name}`

        const sendEmailCommand = new SendEmailCommand({
            Source: process.env.IMOTKO_EMAIL || "contact@imotko.mk",
            Destination: {
                ToAddresses: [agency.email],
            },
            Message: {
                Subject: {
                    Data: emailSubject,
                    Charset: "UTF-8",
                },
                Body: {
                    Html: {
                        Data: htmlContent,
                        Charset: "UTF-8",
                    },
                    Text: {
                        Data: `
                    New Contact Form Submission
                    Name: ${name}
                    ${email ? `Email: ${email}` : ""}
                    Phone: ${phone}
                    ${subject ? `Subject: ${subject}` : ""}
                    ${message ? `Message: ${message}` : ""}
                    ${propertyId ? `Недвижност: #${propertyId}` : ""}

                     Примено на: ${new Date().toLocaleString("en-US", { timeZone: "UTC" })} UTC
                        `.trim(),
                        Charset: "UTF-8",
                    },
                },
            },
            ReplyToAddresses: email ? [email] : undefined,
        })

        const response = await emailClient.send(sendEmailCommand)

        return {
            success: true,
            data: {
                messageId: response.MessageId,
                sentTo: agency.email,
            },
        }
    } catch (error) {
        console.error("Error sending contact form email:", error)
        return {
            success: false,
            error: {
                code: 500,
                message: "Failed to send contact form email",
            },
        }
    }
}
