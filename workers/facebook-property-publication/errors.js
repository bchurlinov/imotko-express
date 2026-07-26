export class MetaCryptoError extends Error {
    constructor(message) {
        super(message)
        this.name = "MetaCryptoError"
    }
}

export class FacebookApiError extends Error {
    constructor(
        message,
        { connectionStatus = null, errorCode = null, metaCode = null, metaSubcode = null, fbtraceId = null } = {}
    ) {
        super(message)
        this.name = "FacebookApiError"
        this.connectionStatus = connectionStatus
        this.errorCode = errorCode
        this.metaCode = metaCode
        this.metaSubcode = metaSubcode
        this.fbtraceId = fbtraceId
    }
}

export class RetryablePublicationError extends Error {
    constructor(message, { errorCode = null, metaCode = null, metaSubcode = null, fbtraceId = null, cause } = {}) {
        super(message, { cause })
        this.name = "RetryablePublicationError"
        this.errorCode = errorCode
        this.metaCode = metaCode
        this.metaSubcode = metaSubcode
        this.fbtraceId = fbtraceId
    }
}
