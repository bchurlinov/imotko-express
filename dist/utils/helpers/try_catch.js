export function tryCatch(fn) {
    return async (...args) => {
        try {
            const result = await fn(...args);
            return [null, result];
        }
        catch (error) {
            return [error instanceof Error ? error : new Error(String(error)), undefined];
        }
    };
}
export function tryCatchSync(fn) {
    return function (...args) {
        try {
            return [undefined, fn(...args)];
        }
        catch (error) {
            return [error instanceof Error ? error : new Error(String(error)), undefined];
        }
    };
}
