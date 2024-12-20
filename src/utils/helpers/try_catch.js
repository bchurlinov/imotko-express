export function tryCatch(fn) {
    return async (...args) => {
        try {
            const result = await fn(...args)
            return [null, result]
        } catch (error) {
            return [error, undefined]
        }
    }
}

export const tryCatchSync = fn =>
    function () {
        const args = Array.of(...arguments)
        try {
            return [undefined, fn(...args)]
        } catch (e) {
            return [e]
        }
    }
