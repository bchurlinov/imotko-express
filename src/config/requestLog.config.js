import morgan from "morgan"

/**
 * Request log line. Shows who is calling, so traffic can be traced to the mobile app, an agency site or an outside
 * client. `client` and `referrer` are caller-supplied and can be forged; only `internal=yes` is proven, because the
 * rate limit middleware checks it against INTERNAL_API_SECRET. Morgan resolves tokens when the response finishes, so
 * that flag is already set even though this logger runs first.
 */
export const REQUEST_LOG_FORMAT =
    ':method :url :status :response-time ms - :res[content-length] ip=:remote-addr client=:imotko-client internal=:imotko-internal referrer=":referrer" ua=":user-agent"'

morgan.token("imotko-client", req => req.headers["x-imotko-client"])
morgan.token("imotko-internal", req => (req.trustedInternalCaller === true ? "yes" : "no"))

/**
 * Builds the request logger
 * @param {import('morgan').Options<import('express').Request, import('express').Response>} [options] - Morgan options
 * @returns {import('express').RequestHandler} Logging middleware
 */
export const createRequestLogger = options => morgan(REQUEST_LOG_FORMAT, options)
