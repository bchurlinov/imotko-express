export class ChatError extends Error {
    constructor(code, status = 400, data = undefined) {
        super(code)
        this.name = "ChatError"
        this.code = code
        this.status = status
        this.data = data
    }
}
