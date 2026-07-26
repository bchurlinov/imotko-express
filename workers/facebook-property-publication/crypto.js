import { createDecipheriv } from "node:crypto"
import { MetaCryptoError } from "./errors.js"

const ENVELOPE_VERSION = 1
const IV_LENGTH = 12
const TAG_LENGTH = 16
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]*$/

const invalidToken = () => new MetaCryptoError("Invalid encrypted Meta token")

const decodeCanonicalBase64Url = value => {
    if (typeof value !== "string" || !BASE64URL_PATTERN.test(value)) throw invalidToken()

    const decoded = Buffer.from(value, "base64url")
    if (decoded.toString("base64url") !== value) throw invalidToken()
    return decoded
}

const parseKey = tokenEncryptionKey => {
    if (typeof tokenEncryptionKey !== "string") throw new MetaCryptoError("Invalid Meta token encryption key")
    const key = Buffer.from(tokenEncryptionKey, "base64")
    if (key.length !== 32) throw new MetaCryptoError("Invalid Meta token encryption key")
    return key
}

const parseEnvelope = encryptedToken => {
    try {
        const envelope = JSON.parse(decodeCanonicalBase64Url(encryptedToken).toString("utf8"))
        if (
            envelope?.v !== ENVELOPE_VERSION ||
            typeof envelope.iv !== "string" ||
            typeof envelope.tag !== "string" ||
            typeof envelope.ciphertext !== "string"
        ) {
            throw invalidToken()
        }

        const iv = decodeCanonicalBase64Url(envelope.iv)
        const tag = decodeCanonicalBase64Url(envelope.tag)
        const ciphertext = decodeCanonicalBase64Url(envelope.ciphertext)
        if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH || ciphertext.length === 0) throw invalidToken()
        return { iv, tag, ciphertext }
    } catch {
        throw invalidToken()
    }
}

export function decryptMetaToken(encryptedToken, tokenEncryptionKey) {
    if (typeof encryptedToken !== "string" || !encryptedToken) throw invalidToken()
    const key = parseKey(tokenEncryptionKey)
    const { iv, tag, ciphertext } = parseEnvelope(encryptedToken)

    try {
        const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_LENGTH })
        decipher.setAuthTag(tag)
        const token = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
        if (!token) throw invalidToken()
        return token
    } catch {
        throw invalidToken()
    }
}
