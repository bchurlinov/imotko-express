import { trackListingFirstContact } from "#shared/chat/listing_first_contact.js"

// Chat side effects that specs replace (the same pattern as clientListingEffects). The tracker decides whether a
// delivered message is a private listing's first contact; callers only pass ids of messages that were delivered.
export const chatEffects = { firstContact: trackListingFirstContact }

export const trackFirstContactOf = messageId => {
    if (messageId) void chatEffects.firstContact(messageId)
}
