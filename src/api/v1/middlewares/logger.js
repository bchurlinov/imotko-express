import fs from "fs"
import { format } from "date-fns"
import { v4 as uuid } from "uuid"
import { fileURLToPath } from "url"
import path from "path"

const fsPromises = fs.promises
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Log events to a file
 * @param {string} message - The message to log
 * @param {string} logName - The name of the log file
 * @returns {Promise<void>}
 */
export const logEvents = async (message, logName) => {
    const dateTime = `${format(new Date(), "yyyyMMdd\tHH:mm:ss")}`
    const logItem = `${dateTime}\t${uuid()}\t${message}\n`

    try {
        if (!fs.existsSync(path.join(__dirname, "..", "logs")))
            await fsPromises.mkdir(path.join(__dirname, "..", "logs"))

        await fsPromises.appendFile(path.join(__dirname, "..", "logs", logName), logItem)
    } catch (err) {
        console.log(err)
    }
}

// export const logger = (req, res, next) => {
//     logEvents(`${req.method}\t${req.headers.origin || "localhost"}\t${req.url}`, "reqLog.txt")
//     console.log(`${req.method} ${req.path}`)
//     next()
// }
