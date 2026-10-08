import prisma from "#database/client.js"
import { isVersionAtLeast } from "#middlewares/client_capabilities.js"
import { sendExpoPushBatch } from "#services/chat/chat_push.service.js"

// App 1.0.5 has no update banner, so after 1.1.0 is live in both stores the owner runs this once (design D §4.7).
// 1.0.5 shows any push; a tap only opens the app (it cannot open a store), and the notification list keeps the text.
const TEXTS = {
    mk: {
        title: "Нова верзија на Имотко",
        body: "Ажурирајте ја апликацијата за краткорочно изнајмување и објавување огласи.",
    },
    en: { title: "New Imotko version", body: "Update the app to rent short-term and publish your own listings." },
    sq: {
        title: "Version i ri i Imotko",
        body: "Përditësoni aplikacionin për qira afatshkurtër dhe për të publikuar shpalljet tuaja.",
    },
    tr: {
        title: "Imotko'nun yeni sürümü",
        body: "Kısa süreli kiralama ve kendi ilanlarınızı yayınlamak için uygulamayı güncelleyin.",
    },
}
const BATCH_SIZE = 100

export const selectAnnouncementRecipients = (tokens, latestVersion) => {
    const upToDate = new Set(
        tokens.filter(token => token.appVersion && isVersionAtLeast(token.appVersion, latestVersion)).map(token => token.userId)
    )
    const byUser = new Map()
    for (const token of tokens) {
        if (upToDate.has(token.userId)) continue
        if (token.appVersion && isVersionAtLeast(token.appVersion, latestVersion)) continue
        const entry = byUser.get(token.userId) ?? { userId: token.userId, locale: token.locale, tokens: [] }
        entry.tokens.push({ id: token.id, token: token.token })
        byUser.set(token.userId, entry)
    }
    return [...byUser.values()]
}

export const announceAppUpdate = async ({ dryRun = true, latestVersion, prismaClient = prisma, sendBatch = sendExpoPushBatch }) => {
    const tokens = await prismaClient.userPushToken.findMany({
        select: { id: true, token: true, userId: true, locale: true, appVersion: true },
    })
    const recipients = selectAnnouncementRecipients(tokens, latestVersion)
    const tokenCount = recipients.reduce((sum, recipient) => sum + recipient.tokens.length, 0)
    if (dryRun) return { users: recipients.length, tokens: tokenCount, sent: 0 }

    const messages = recipients.flatMap(recipient => {
        const text = TEXTS[recipient.locale] ?? TEXTS.mk
        return recipient.tokens.map(({ token }) => ({
            to: token,
            title: text.title,
            body: text.body,
            sound: "default",
            channelId: "chat",
            priority: "high",
            data: { type: "app_update" },
        }))
    })
    let sent = 0
    for (let start = 0; start < messages.length; start += BATCH_SIZE) {
        const tickets = await sendBatch(messages.slice(start, start + BATCH_SIZE))
        sent += tickets.filter(ticket => ticket?.status === "ok").length
    }
    await prismaClient.notification.createMany({
        data: recipients.map(recipient => {
            const text = TEXTS[recipient.locale] ?? TEXTS.mk
            return { recipientId: recipient.userId, title: text.title, description: text.body, metadata: { kind: "app_update" } }
        }),
    })
    return { users: recipients.length, tokens: tokenCount, sent }
}
