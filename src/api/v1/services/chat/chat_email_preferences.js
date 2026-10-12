// Web owns the opt-out page (/poraki/otkazi-izvestuvanja/<token>); Express only links to it. Agencies get no link
// here: their token is signed with the web's AUTH_SECRET, which Express does not have.
const CLIENT_CHAT_EMAIL_UNSUBSCRIBE = "/poraki/otkazi-izvestuvanja"

// A client with no client row counts as opted in, like the column default.
export const chatEmailAllowed = participant =>
    !participant?.userId || participant.user?.client?.chatEmailsEnabled !== false

export const chatEmailUnsubscribeLink = (participant, appUrl, locale) => {
    const token = participant?.userId ? participant.user?.client?.chatEmailsUnsubscribeToken : null
    return token ? `${appUrl}/${locale}${CLIENT_CHAT_EMAIL_UNSUBSCRIBE}/${token}` : ""
}
