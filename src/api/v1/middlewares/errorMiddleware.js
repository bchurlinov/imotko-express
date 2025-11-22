import { logEvents } from "./logger.js"
import morgan from "morgan"
import chalk from "chalk"

// Define a custom Morgan format for errors
morgan.token("errorMessage", (req, res) => res.locals.errorMessage || "No Error Message")

/**
 * Error handling middleware
 * @param {Error & { status?: number, errors?: any }} error - Error object
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
export const errorMiddleware = async (error, req, res, next) => {
    const status = error.status || 500 // Default to 500 if no status provided
    const message = error.message || "Something went wrong" // Default error message
    const errors = error.errors || null // Details for validation or specific errors
    const stack = process.env.NODE_ENV === "development" ? error.stack : undefined // Stack trace in development

    // Log to file
    await logEvents(`${error.name}: ${error.message}`, "errLog.txt")

    // Store the error message for use in Morgan logging
    res.locals.errorMessage = message

    // Log the error to the console in red color using Chalk
    console.error(
        chalk.red.bold(`Error Status: ${status}`),
        chalk.red(`Message: ${message}`),
        chalk.red(stack ? `Stack: ${stack}` : "")
    )

    // Use Morgan to log the request and error details
    morgan((tokens, req, res) => {
        return [
            chalk.red("ERROR >>>"),
            chalk.yellow(tokens.method(req, res)),
            chalk.cyan(tokens.url(req, res)),
            chalk.red(`Status: ${tokens.status(req, res)}`),
            chalk.red(`Message: ${res.locals.errorMessage}`),
            chalk.magenta(`Response Time: ${tokens["response-time"](req, res)} ms`),
        ].join(" ")
    })(req, res, () => {})

    // Return the standardized error response
    res.status(status).json({
        status,
        message,
        ...(errors && { errors }), // Include detailed errors if available
        ...(stack && { stack }), // Include stack trace in development
    })
}
