import fs from "node:fs"
import path from "node:path"
import Handlebars from "handlebars"
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses"
import prisma from "#database/client.js"
import { resolveEmailDelivery } from "#utils/email/delivery_policy.js"
import { pickLocalized } from "./chat_format.js"
import { appendImotkoEmailFooter } from "#utils/email/email_footer.js"
import {
    chatEmailAllowed,
    chatEmailUnsubscribeLink,
    clientOptedOutOfImotkoEmails,
    imotkoEmailUnsubscribeLink,
} from "./chat_email_preferences.js"
import { chatLocaleText } from "./chat_locales.js"
import { conversationLink, resolveParticipantRecipient } from "./chat_notifications.service.js"
import { userLanguageToLocale } from "./chat_policy.js"

const templatePath = path.join(process.cwd(), "src/messages/email/chat-new-message.hbs")
const template = Handlebars.compile(fs.readFileSync(templatePath, "utf8"))

const emailClient = new SESClient({
    region: process.env.AWS_SES_REGION,
    credentials:
        process.env.AWS_SES_KEY && process.env.AWS_SES_SECRET_KEY
            ? { accessKeyId: process.env.AWS_SES_KEY, secretAccessKey: process.env.AWS_SES_SECRET_KEY }
            : undefined,
})

// One line per decision, so a skipped or failed email is visible without checking SES. No addresses or message text.
const logOutcome = (participantId, outcome, details = {}) =>
    (outcome === "failed" ? console.error : console.info)("[chat-email]", { participantId, outcome, ...details })
const skip = (participantId, reason) => {
    logOutcome(participantId, "skipped", { reason })
    return false
}

export const sendChatNewMessageEmail = async participantId => {
    try {
        const participant = await prisma.conversationParticipant.findUnique({
            where: { id: participantId },
            select: {
                id: true,
                userId: true,
                agencyId: true,
                assignedMemberId: true,
                agency: { select: { emailNotificationsEnabled: true } },
                user: {
                    select: {
                        client: {
                            select: {
                                receiveCompanyEmail: true,
                                chatEmailsEnabled: true,
                                chatEmailsUnsubscribeToken: true,
                            },
                        },
                    },
                },
                conversation: {
                    select: {
                        id: true,
                        kind: true,
                        propertySnapshot: true,
                        participants: { select: { id: true, displayName: true } },
                    },
                },
            },
        })
        if (!participant) return skip(participantId, "participant-not-found")
        if (["PLATFORM_SUPPORT", "PLATFORM_TOPIC"].includes(participant.conversation?.kind)) {
            return skip(participantId, "platform-conversation")
        }
        if (participant.agencyId && !participant.agency?.emailNotificationsEnabled) {
            return skip(participantId, "agency-notifications-off")
        }
        if (clientOptedOutOfImotkoEmails(participant)) return skip(participantId, "client-opted-out")
        if (!chatEmailAllowed(participant)) return skip(participantId, "opted-out")
        const recipient = await resolveParticipantRecipient(prisma, participant)
        if (!recipient?.email) return skip(participantId, "no-recipient")

        const locale = userLanguageToLocale(recipient.language)
        const counterpart = participant.conversation.participants.find(item => item.id !== participant.id)
        const propertyTitle = pickLocalized(participant.conversation.propertySnapshot?.name, locale)
        const appUrl = (process.env.IMOTKO_WEB_URL || "https://imotko.mk").replace(/\/$/, "")
        const link = `${appUrl}${conversationLink(recipient.side, locale, participant.conversation.id)}`
        const unsubscribeLink = chatEmailUnsubscribeLink(participant, appUrl, locale)
        const imotkoUnsubscribeLink = imotkoEmailUnsubscribeLink(participant, appUrl, locale)
        const sender = counterpart?.displayName || "Imotko"
        // Same copy and layout as the web app's chat email; outreach to a listing owner gets its own wording.
        const isOutreach = participant.conversation.kind === "AGENCY_OUTREACH" && Boolean(participant.userId)
        const subject = chatLocaleText(locale, isOutreach ? "emailOutreachSubject" : "emailSubject")
        const headline = chatLocaleText(locale, isOutreach ? "emailOutreachTitle" : "emailHeadline")
        const intro = isOutreach
            ? chatLocaleText(locale, "emailOutreachIntro", { name: sender })
            : chatLocaleText(locale, propertyTitle ? "emailIntroWithProperty" : "emailIntroNoProperty", {
                  name: sender,
              })
        const instructions = `${chatLocaleText(locale, "emailInstructions")} ${chatLocaleText(locale, "emailAccountNote")}`
        const imotkoUnsubscribe = imotkoUnsubscribeLink
            ? {
                  text: chatLocaleText(locale, "emailImotkoUnsubscribeText"),
                  label: chatLocaleText(locale, "emailImotkoUnsubscribeLabel"),
                  link: imotkoUnsubscribeLink,
              }
            : undefined
        const html = appendImotkoEmailFooter(
            template({
                locale,
                preheader: chatLocaleText(locale, "emailPreheader", { name: sender }),
                greeting: chatLocaleText(locale, "emailGreeting", { name: recipient.name || recipient.email }),
                headline,
                intro,
                propertyLabel: chatLocaleText(locale, "emailPropertyLabel"),
                propertyTitle,
                instructions,
                openLabel: chatLocaleText(locale, "emailOpen"),
                footerNote: chatLocaleText(locale, "emailFooterNote"),
                link,
                unsubscribeLink,
                unsubscribeText: chatLocaleText(locale, "emailUnsubscribeText"),
                unsubscribeLabel: chatLocaleText(locale, "emailUnsubscribeLabel"),
                year: new Date().getFullYear(),
            }),
            { unsubscribe: imotkoUnsubscribe }
        )
        const text = [
            headline,
            intro,
            propertyTitle,
            instructions,
            link,
            unsubscribeLink
                ? `${chatLocaleText(locale, "emailUnsubscribeText")} ${chatLocaleText(locale, "emailUnsubscribeLabel")}: ${unsubscribeLink}`
                : "",
            imotkoUnsubscribe ? `${imotkoUnsubscribe.text} ${imotkoUnsubscribe.label}: ${imotkoUnsubscribe.link}` : "",
        ]
            .filter(Boolean)
            .join("\n\n")

        const delivery = resolveEmailDelivery({
            to: [recipient.email],
            subject,
        })
        const result = await emailClient.send(
            new SendEmailCommand({
                Source: process.env.IMOTKO_EMAIL || "contact@imotko.mk",
                Destination: { ToAddresses: delivery.toAddresses },
                ReplyToAddresses: delivery.replyToAddresses,
                Message: {
                    Subject: { Data: delivery.subject, Charset: "UTF-8" },
                    Body: {
                        Html: { Data: html, Charset: "UTF-8" },
                        Text: { Data: text, Charset: "UTF-8" },
                    },
                },
            })
        )
        logOutcome(participantId, "sent", {
            side: recipient.side,
            redirected: delivery.redirected,
            messageId: result?.MessageId,
        })
        return true
    } catch (error) {
        logOutcome(participantId, "failed", { error: error instanceof Error ? error.message : String(error) })
        return false
    }
}

// Delivery is already committed when this is called. Email must never affect chat state.
export const queueChatNewMessageEmail = participantId => {
    if (participantId) void sendChatNewMessageEmail(participantId)
}
