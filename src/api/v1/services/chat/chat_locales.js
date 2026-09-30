const messages = {
    mk: {
        newTitle: "Нова порака",
        newDescription: "Имате нова порака во сандачето.",
        restrictedTitle: "Пораките се паузирани",
        restrictedDescription: "Испраќањето пораки е привремено оневозможено додека трае проверката на вашиот профил.",
        restoredTitle: "Пораките се повторно достапни",
        restoredDescription: "Повторно можете да испраќате пораки.",
        deletedTitle: "Разговорот е затворен",
        deletedDescription: "{name} го избриша својот профил.",
        emailSubject: "Имате нова порака на Imotko",
        emailHeadline: "Имате нова порака",
        emailOpen: "Отворете разговор",
        emailInstructions: "Отворете го разговорот за да ја прочитате пораката и да одговорите.",
    },
    en: {
        newTitle: "New message",
        newDescription: "You have a new message in your inbox.",
        restrictedTitle: "Messaging paused",
        restrictedDescription: "We're checking your account. Try again later.",
        restoredTitle: "Messaging available again",
        restoredDescription: "You can send messages again.",
        deletedTitle: "Conversation closed",
        deletedDescription: "{name} deleted their account.",
        emailSubject: "You have a new message on Imotko",
        emailHeadline: "You have a new message",
        emailOpen: "Open conversation",
        emailInstructions: "Open the conversation to read the message and reply.",
    },
    sq: {
        newTitle: "Mesazh i ri",
        newDescription: "Keni një mesazh të ri në kutinë tuaj.",
        restrictedTitle: "Mesazhet janë pezulluar",
        restrictedDescription: "Po e kontrollojmë llogarinë tuaj. Provoni përsëri më vonë.",
        restoredTitle: "Mesazhet janë përsëri të disponueshme",
        restoredDescription: "Mund të dërgoni përsëri mesazhe.",
        deletedTitle: "Biseda u mbyll",
        deletedDescription: "{name} e ka fshirë llogarinë.",
        emailSubject: "Keni një mesazh të ri në Imotko",
        emailHeadline: "Keni një mesazh të ri",
        emailOpen: "Hap bisedën",
        emailInstructions: "Hapni bisedën për ta lexuar mesazhin dhe për t'u përgjigjur.",
    },
    tr: {
        newTitle: "Yeni mesaj",
        newDescription: "Gelen kutunuzda yeni bir mesajınız var.",
        restrictedTitle: "Mesajlaşma duraklatıldı",
        restrictedDescription: "Hesabınızı inceliyoruz. Lütfen daha sonra tekrar deneyin.",
        restoredTitle: "Mesajlaşma yeniden kullanılabilir",
        restoredDescription: "Tekrar mesaj gönderebilirsiniz.",
        deletedTitle: "Görüşme kapatıldı",
        deletedDescription: "{name} hesabını sildi.",
        emailSubject: "Imotko'da yeni bir mesajınız var",
        emailHeadline: "Yeni mesajınız var",
        emailOpen: "Görüşmeyi aç",
        emailInstructions: "Mesajı okumak ve yanıtlamak için görüşmeyi açın.",
    },
}

export const chatLocaleText = (locale, key, variables = {}) => {
    const value = (messages[locale] || messages.mk)[key] || ""
    return value.replace(/\{(\w+)\}/g, (_, name) => String(variables[name] ?? ""))
}

const systemEvents = {
    accountDeleted: {
        mk: "Корисникот го избриша својот профил.",
        en: "The user deleted their account.",
        sq: "Përdoruesi e fshiu llogarinë e tij.",
        tr: "Kullanıcı hesabını sildi.",
    },
    agencyRemovedConversation: {
        mk: "Агенцијата го отстрани разговорот.",
        en: "The agency removed this conversation.",
        sq: "Agjencia e hoqi këtë bisedë.",
        tr: "Ajans bu görüşmeyi kaldırdı.",
    },
    clientRemovedConversation: {
        mk: "Клиентот го отстрани разговорот.",
        en: "The client removed this conversation.",
        sq: "Klienti e hoqi këtë bisedë.",
        tr: "Müşteri bu görüşmeyi kaldırdı.",
    },
}

export const chatSystemEventText = (locale, event) => systemEvents[event]?.[locale] || systemEvents[event]?.mk || event
