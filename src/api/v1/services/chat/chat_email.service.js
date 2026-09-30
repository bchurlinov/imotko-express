import fs from "node:fs"
import path from "node:path"
import Handlebars from "handlebars"
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses"
import prisma from "#database/client.js"
import { pickLocalized } from "./chat_format.js"
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
                conversation: {
                    select: {
                        id: true,
                        propertySnapshot: true,
                        participants: { select: { id: true, displayName: true } },
                    },
                },
            },
        })
        if (!participant || (participant.agencyId && !participant.agency?.emailNotificationsEnabled)) return false
        const recipient = await resolveParticipantRecipient(prisma, participant)
        if (!recipient?.email) return false

        const locale = userLanguageToLocale(recipient.language)
        const counterpart = participant.conversation.participants.find(item => item.id !== participant.id)
        const propertyTitle = pickLocalized(participant.conversation.propertySnapshot?.name, locale)
        const appUrl = (process.env.IMOTKO_WEB_URL || "https://imotko.mk").replace(/\/$/, "")
        const link = `${appUrl}${conversationLink(recipient.side, locale, participant.conversation.id)}`
        const html = template({
            locale,
            headline: chatLocaleText(locale, "emailHeadline"),
            intro: counterpart?.displayName || "Imotko",
            propertyLabel: propertyTitle ? "Listing" : "",
            propertyTitle,
            instructions: chatLocaleText(locale, "emailInstructions"),
            openLabel: chatLocaleText(locale, "emailOpen"),
            link,
        })
        const text = [
            chatLocaleText(locale, "emailHeadline"),
            counterpart?.displayName || "Imotko",
            propertyTitle,
            chatLocaleText(locale, "emailInstructions"),
            link,
        ]
            .filter(Boolean)
            .join("\n\n")

        await emailClient.send(
            new SendEmailCommand({
                Source: process.env.IMOTKO_EMAIL || "contact@imotko.mk",
                Destination: { ToAddresses: [recipient.email] },
                Message: {
                    Subject: { Data: chatLocaleText(locale, "emailSubject"), Charset: "UTF-8" },
                    Body: {
                        Html: { Data: html, Charset: "UTF-8" },
                        Text: { Data: text, Charset: "UTF-8" },
                    },
                },
            })
        )
        return true
    } catch (error) {
        console.error("[chat-email] send failed", {
            participantId,
            error: error instanceof Error ? error.message : String(error),
        })
        return false
    }
}

// Delivery is already committed when this is called. Email must never affect chat state.
export const queueChatNewMessageEmail = participantId => {
    if (participantId) void sendChatNewMessageEmail(participantId)
}
