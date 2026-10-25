import fs from "node:fs"
import path from "node:path"
import Handlebars from "handlebars"
import { sanitizeServer } from "#shared/property_rules/sanitize_server.js"

/**
 * Input checks and rendering for a bulk admin email (imotko /smetka/admin/emails), moved here from the web app's
 * server action so the send can run in the bulk email worker.
 *
 * @module services/email/bulk_email_request
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Far above any real list (a few thousand accounts); keeps one request from flooding the queue
const MAX_RECIPIENTS = 20000

const templatePath = path.join(process.cwd(), "src/messages/email/bulk_email_admin_mk.hbs")
let template

const trimmed = value => (typeof value === "string" ? value.trim() : "")
const normalizeEmail = value => trimmed(value).toLowerCase()
const isEmail = value => EMAIL_PATTERN.test(value)

const fail = (message, extra = {}) => ({ ok: false, message, ...extra })

/**
 * @param {unknown} body - Parsed JSON body sent by imotko
 * @returns {{ ok: true, request: { campaignId: string, subject: string, replyTo: string, message: string,
 *   recipientMode: string, recipients: string[], deliveryMode: "real" | "redirect" } }
 *   | { ok: false, message: string, invalidEmails?: string[] }}
 */
export const parseBulkEmailRequest = body => {
    const campaignId = trimmed(body?.campaignId)
    if (!UUID_PATTERN.test(campaignId)) return fail("A valid campaign id is required.")

    const subject = trimmed(body?.subject)
    if (!subject) return fail("Subject is required.")

    const replyTo = normalizeEmail(body?.fromEmail)
    if (!isEmail(replyTo)) return fail("A valid from email is required.")

    const message = trimmed(body?.message)
    if (!message) return fail("Message is required.")

    const unique = new Set()
    const invalidEmails = []
    for (const recipient of Array.isArray(body?.recipients) ? body.recipients : []) {
        const email = normalizeEmail(recipient)
        if (!email) continue
        if (isEmail(email)) unique.add(email)
        else invalidEmails.push(email)
    }
    if (invalidEmails.length) return fail("One or more recipient emails are invalid.", { invalidEmails })
    if (!unique.size) return fail("At least one recipient is required.")
    if (unique.size > MAX_RECIPIENTS) return fail(`At most ${MAX_RECIPIENTS} recipients per send.`)

    return {
        ok: true,
        request: {
            campaignId,
            subject,
            replyTo,
            message,
            recipientMode: trimmed(body?.recipientMode),
            recipients: [...unique],
            // Only a production web app may reach real inboxes; Preview/local campaigns go to the dev inbox
            deliveryMode: body?.deliveryMode === "real" ? "real" : "redirect",
        },
    }
}

/**
 * Same allow-list the web action used for the admin editor's HTML.
 * @param {string} html
 * @returns {string}
 */
export const sanitizeBulkEmailMessage = html =>
    sanitizeServer(html, {
        ALLOWED_TAGS: ["p", "b", "i", "strong", "em", "a", "br", "ul", "ol", "li"],
        ALLOWED_ATTR: ["href", "target", "rel"],
    })

/**
 * @param {{ title: string, content: string }} data - content must already be sanitized
 * @returns {string} Email HTML without the Imotko footer (the worker adds it per recipient)
 */
export const renderBulkEmailHtml = ({ title, content }) => {
    template ||= Handlebars.compile(fs.readFileSync(templatePath, "utf8"))
    return template({ title, content })
}
