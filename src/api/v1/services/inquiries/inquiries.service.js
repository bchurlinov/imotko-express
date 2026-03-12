import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses"
import { createContactRequestEmailTemplate } from "./templates/contact_request_email_template.js"

const emailClient = new SESClient({
    region: process.env.AWS_SES_REGION,
    credentials: {
        accessKeyId: process.env.AWS_SES_KEY,
        secretAccessKey: process.env.AWS_SES_SECRET_KEY,
    },
})

const RECIPIENT_EMAIL = "contact@imotko.mk"

/**
 * Service to handle public mobile contact requests and send an email
 * @param {Object} body - Form data from request body
 * @param {string} body.helpType - Requested help type
 * @param {string} body.category - Property category
 * @param {number} body.price - Requested price
 * @param {string} body.location - Property location
 * @param {string} body.name - Contact name
 * @param {string} body.email - Contact email
 * @param {string} body.phone - Contact phone
 * @param {string} body.message - Contact message
 * @returns {Promise<{success: boolean, data?: Object, error?: {code: number, message: string}}>}
 */
export async function postContactRequestService(body) {
    try {
        const { helpType, category, price, location, name, email, phone, message } = body
        const safeHelpType = helpType.replace(/[\r\n]+/g, " ").trim()
        const htmlContent = createContactRequestEmailTemplate({
            helpType: safeHelpType,
            category,
            price,
            location,
            name,
            email,
            phone,
            message,
        })

        const formattedPrice = new Intl.NumberFormat("mk-MK", {
            minimumFractionDigits: Number.isInteger(price) ? 0 : 2,
            maximumFractionDigits: 2,
        }).format(price)

        const receivedAt = new Date().toLocaleString("mk-MK", { timeZone: "Europe/Skopje" })
        const emailSubject = `Ново барање од мобилна апликација: ${safeHelpType}`

        const sendEmailCommand = new SendEmailCommand({
            Source: process.env.IMOTKO_EMAIL || RECIPIENT_EMAIL,
            Destination: {
                ToAddresses: [RECIPIENT_EMAIL],
            },
            Message: {
                Subject: {
                    Data: emailSubject,
                    Charset: "UTF-8",
                },
                Body: {
                    Html: {
                        Data: htmlContent,
                        Charset: "UTF-8",
                    },
                    Text: {
                        Data: `
Ново барање од мобилна апликација
Потреба: ${safeHelpType}
Категорија: ${category}
Цена: ${formattedPrice}
Локација: ${location}
Име: ${name}
Е-пошта: ${email}
Телефон: ${phone}
Порака: ${message}
Примено на: ${receivedAt}
                        `.trim(),
                        Charset: "UTF-8",
                    },
                },
            },
            ReplyToAddresses: [email],
        })

        const response = await emailClient.send(sendEmailCommand)

        return {
            success: true,
            data: {
                messageId: response.MessageId,
                sentTo: RECIPIENT_EMAIL,
            },
        }
    } catch (error) {
        console.error("Error sending contact request email:", error)
        return {
            success: false,
            error: {
                code: 500,
                message: "Failed to send contact request email",
            },
        }
    }
}
