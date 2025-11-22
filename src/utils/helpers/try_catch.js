/**
 * Wraps an async function with try-catch and returns [error, result]
 * @template TResult
 * @param {(...args: any[]) => Promise<TResult>} fn - The async function to wrap
 * @returns {(...args: any[]) => Promise<[Error | null, TResult | undefined]>}
 */
export function tryCatch(fn) {
    return async (...args) => {
        try {
            const result = await fn(...args)
            return [null, result]
        } catch (error) {
            return [error instanceof Error ? error : new Error(String(error)), undefined]
        }
    }
}

/**
 * Wraps a sync function with try-catch and returns [error, result]
 * @template TResult
 * @param {(...args: any[]) => TResult} fn - The sync function to wrap
 * @returns {(...args: any[]) => [Error | undefined, TResult | undefined]}
 */
export function tryCatchSync(fn) {
    return function (...args) {
        try {
            return [undefined, fn(...args)]
        } catch (error) {
            return [error instanceof Error ? error : new Error(String(error)), undefined]
        }
    }
}
