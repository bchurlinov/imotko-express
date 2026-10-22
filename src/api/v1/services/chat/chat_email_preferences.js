// Web owns the opt-out pages (/poraki/otkazi-izvestuvanja/<token> for chat only, /otkazi-izvestuvanja/<token> for all
// Imotko emails); Express only links to them. Agencies get no link here: their token is signed with the web's
// AUTH_SECRET, which Express does not have.
const CLIENT_CHAT_EMAIL_UNSUBSCRIBE = "/poraki/otkazi-izvestuvanja"
const CLIENT_EMAIL_UNSUBSCRIBE = "/otkazi-izvestuvanja"

// Master switch (Client.receiveCompanyEmail). A client with no client row counts as opted in, like the column default.
export const clientOptedOutOfImotkoEmails = participant =>
    Boolean(participant?.userId) && participant.user?.client?.receiveCompanyEmail === false

export const chatEmailAllowed = participant =>
    !clientOptedOutOfImotkoEmails(participant) &&
    (!participant?.userId || participant.user?.client?.chatEmailsEnabled !== false)

export const chatEmailUnsubscribeLink = (participant, appUrl, locale) => {
    const token = participant?.userId ? participant.user?.client?.chatEmailsUnsubscribeToken : null
    return token ? `${appUrl}/${locale}${CLIENT_CHAT_EMAIL_UNSUBSCRIBE}/${token}` : ""
}

export const imotkoEmailUnsubscribeLink = (participant, appUrl, locale) => {
    const token = participant?.userId ? participant.user?.client?.chatEmailsUnsubscribeToken : null
    return token ? `${appUrl}/${locale}${CLIENT_EMAIL_UNSUBSCRIBE}/${token}` : ""
}
