export function tryCatch<TArgs extends any[], TResult>(
    fn: (...args: TArgs) => Promise<TResult>
): (...args: TArgs) => Promise<[Error | null, TResult | undefined]> {
    return async (...args: TArgs): Promise<[Error | null, TResult | undefined]> => {
        try {
            const result = await fn(...args)
            return [null, result]
        } catch (error) {
            return [error instanceof Error ? error : new Error(String(error)), undefined]
        }
    }
}

export function tryCatchSync<TArgs extends any[], TResult>(
    fn: (...args: TArgs) => TResult
): (...args: TArgs) => [Error | undefined, TResult | undefined] {
    return function (...args: TArgs): [Error | undefined, TResult | undefined] {
        try {
            return [undefined, fn(...args)]
        } catch (error) {
            return [error instanceof Error ? error : new Error(String(error)), undefined]
        }
    }
}
