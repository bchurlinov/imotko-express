import { translation } from "#utils/helpers/translations"
import { tryCatch } from "#utils/helpers/try_catch.ts"
import fs from "fs"
import path from "path"
import nodemailer from "nodemailer"
import handlebars from "handlebars"

const domain = process.env.NEXT_PUBLIC_APP_URL

const templatePath = locale => path.join(process.cwd(), `/public/email_templates/email_template_default_${locale}.hbs`)
const templatePropertiesPath = locale =>
    path.join(process.cwd(), `/public/email_templates/email_template_with_properties_${locale}.hbs`)

const getTemplate = locale => fs.readFileSync(templatePath(locale), "utf8")
const getTemplateWithProperties = locale => fs.readFileSync(templatePropertiesPath(locale), "utf8")

const compileTemplate = locale => handlebars.compile(getTemplate(locale))
const compileTemplateWithProperties = locale => handlebars.compile(getTemplateWithProperties(locale))

export const EmailTransporter = async (locale = "mk") => {
    const transporter = nodemailer.createTransport({
        host: process.env.ZOHO_HOST,
        service: process.env.ZOHO_HOST,
        secure: true,
        port: 465,
        auth: {
            user: process.env.ZOHO_USERNAME,
            pass: process.env.ZOHO_PASSWORD,
        },
    })

    try {
        await new Promise((resolve, reject) => {
            transporter.verify(function (error, success) {
                if (success) resolve(success)
                reject(error)
            })
        })
    } catch (err) {
        console.error("Verification failed:", err)
    }

    const defaultMailOptions = {
        from: `Imotko <${process.env.ZOHO_EMAIL}>`,
    }

    const template = compileTemplate(locale)
    const templateWithProperties = compileTemplateWithProperties(locale)

    return {
        sendVerificationEmail: async (email, token, redirectUrl = undefined) => {
            let confirmLink = `${domain}/${locale}/auth/verifikacija-na-korisnik?token=${token}`
            if (redirectUrl) confirmLink += `&redirectUrl=${encodeURIComponent(redirectUrl)}`
            const messageContent = translation("Emails.emailConfirmationLinkContent", { link: confirmLink })(locale)
            const htmlToSend = template({
                title: translation("Emails.pleaseConfirmYourEmailTitle")(locale),
                content: messageContent,
                ctaLink: confirmLink,
            })

            const mailOptions = {
                ...defaultMailOptions,
                to: email,
                subject: translation("Emails.confirmYourEmail")(locale),
                html: htmlToSend,
            }

            const [error, result] = await tryCatch(transporter.sendMail.bind(transporter))(mailOptions)
            if (error) throw new Error(`Failed to send email: ${error.message}`)
            return result
        },
        //         sendPasswordResetEmail: async (userId, token, email) => {
        //             const link = `${domain}/${locale}${ROUTE_URL.PASSWORD_RESET}/?userId=${userId}&token=${token}`;
        //             const messageContent = translation("Emails.newPasswordContent", { link: link })(locale);
        //             const htmlToSend = template({
        //                 title: translation("Emails.requestedPasswordChange")(locale),
        //                 content: messageContent,
        //             });
        //
        //             const mailOptions = {
        //                 ...defaultMailOptions,
        //                 to: email,
        //                 subject: translation("Emails.requestedPasswordChange")(locale),
        //                 html: htmlToSend,
        //             };
        //
        //             const [error, result] = await tryCatch(transporter.sendMail.bind(transporter))(mailOptions);
        //             if (error) throw new Error(`Failed to send email: ${error.message}`);
        //             return result;
        //         },
        //         sendSubscriptionEmail: async (subscription, property) => {
        //             const link = `${domain}/${locale}${ROUTE_URL.PROPERTY_DETAILS}/${property.slug}/${property.id}`;
        //             const subscribersEmail = subscription?.client?.user?.email;
        //             const messageContent = translation("Emails.propertySubscriptionContent", { link })(locale);
        //             const htmlToSend = template({
        //                 title: translation("Emails.propertySubscriptionSubject")(locale),
        //                 content: messageContent,
        //             });
        //
        //             const mailOptions = {
        //                 ...defaultMailOptions,
        //                 to: subscribersEmail,
        //                 subject: translation("Emails.propertySubscriptionSubject")(locale),
        //                 html: htmlToSend,
        //             };
        //
        //             const [error, result] = await tryCatch(transporter.sendMail.bind(transporter))(mailOptions);
        //             if (error) throw new Error(`Failed to send email: ${error.message}`);
        //             return result;
        //         },
        //         sendAgencyContactEmail: async ({ agencyEmail, name, email, message, phone, subject }) => {
        //             const messageContent = `
        //             <b>Subject:</b> ${subject ? subject : "-"}<br>
        //             <b>Name:</b> ${name}<br>
        //             <b>Email:</b> ${email}<br>
        //             <b>Phone:</b> ${phone}<br>
        //             <b>Message:</b> ${message}<br>
        // `;
        //             const htmlToSend = template({
        //                 title: translation("Api.userContactAgencyTitle", { name })(locale),
        //                 content: messageContent,
        //             });
        //
        //             const mailOptions = {
        //                 ...defaultMailOptions,
        //                 to: agencyEmail,
        //                 subject: translation("Api.userContactAgencyTitle", { name })(locale),
        //                 html: htmlToSend,
        //             };
        //
        //             const [error, result] = await tryCatch(transporter.sendMail.bind(transporter))(mailOptions);
        //             if (error) throw new Error(`Failed to send email: ${error.message}`);
        //             return result;
        //         },
        //         sharePropertyEmail: async ({ recipientEmail, name, message, shareLink, propertyName }) => {
        //             const formattedMessage = `${message}: ${translation("Emails.userSharedPropertyContent", {
        //                 link: shareLink,
        //                 name: propertyName,
        //             })(locale)}`;
        //
        //             const htmlToSend = template({
        //                 title: translation("Emails.userSharedPropertyTitle", { name })(locale),
        //                 content: formattedMessage,
        //             });
        //
        //             const mailOptions = {
        //                 ...defaultMailOptions,
        //                 to: recipientEmail,
        //                 subject: translation("Emails.userSharedPropertyTitle", { name })(locale),
        //                 html: htmlToSend,
        //             };
        //
        //             const [error, result] = await tryCatch(transporter.sendMail.bind(transporter))(mailOptions);
        //             if (error) throw new Error(`Failed to send email: ${error.message}`);
        //             return result;
        //         },
        //         contactImotkoEmail: async ({ name, email, message }) => {
        //             const messageBody = translation("Emails.contactImotkoMessageFrom", { name, email, message })(locale);
        //             const htmlToSend = template({
        //                 title: translation("Emails.userContactImotkoSubject", { name })(locale),
        //                 content: messageBody,
        //             });
        //
        //             const mailOptions = {
        //                 ...defaultMailOptions,
        //                 to: process.env.ZOHO_EMAIL,
        //                 subject: translation("Emails.userContactImotkoSubject", { name })(locale),
        //                 html: htmlToSend,
        //             };
        //
        //             const [error, result] = await tryCatch(transporter.sendMail.bind(transporter))(mailOptions);
        //             if (error) throw new Error(`Failed to send email: ${error.message}`);
        //             return result;
        //         },
        //         sendFeedback: async ({ name, email, message, url, feedbackType }) => {
        //             const messageBody = translation("Emails.sentImotoFeedbackContent", {
        //                 name,
        //                 email,
        //                 feedbackType,
        //                 message,
        //                 url,
        //             })(locale);
        //
        //             const htmlToSend = template({
        //                 title: translation("Emails.sentImotkoFeedbackTitle", { name })(locale),
        //                 content: messageBody,
        //             });
        //
        //             const mailOptions = {
        //                 ...defaultMailOptions,
        //                 to: process.env.ZOHO_EMAIL,
        //                 subject: translation("Emails.sentImotkoFeedbackSubject", { name })(locale),
        //                 html: htmlToSend,
        //             };
        //
        //             const [error, result] = await tryCatch(transporter.sendMail.bind(transporter))(mailOptions);
        //             if (error) throw new Error(`Failed to send email: ${error.message}`);
        //             return result;
        //         },
        //         sendOffer: async ({ selectedProperties, title, description, email, agency, locale }) => {
        //             const htmlToSend = templateWithProperties({
        //                 propertyDetailsPath: `${domain}/${locale}${ROUTE_URL.PROPERTY_DETAILS}`,
        //                 domain: domain,
        //                 title: title,
        //                 content: description,
        //                 properties: selectedProperties.map((property) => ({
        //                     ...property,
        //                     location: PropertyLocationDictionary[locale].find(
        //                         (location) => location.value === property.location
        //                     )?.label,
        //                 })),
        //                 agency: agency,
        //             });
        //
        //             const mailOptions = {
        //                 ...defaultMailOptions,
        //                 to: email,
        //                 subject: translation("Emails.agencySendOfferSubject", { agencyName: agency.name })(locale),
        //                 html: htmlToSend,
        //             };
        //
        //             const [error, result] = await tryCatch(transporter.sendMail.bind(transporter))(mailOptions);
        //             if (error) throw new Error(`Failed to send email: ${error.message}`);
        //             return result;
        //         },
        //         emailAfterDelete: async ({ name, email }) => {
        //             const title = translation("Emails.heyName", { name })(locale);
        //             const content = translation("Emails.emailAfterDeleteContent", { email: process.env.ZOHO_EMAIL })(locale);
        //             const htmlToSend = template({
        //                 domain: domain,
        //                 title: title,
        //                 content: content,
        //             });
        //
        //             const mailOptions = {
        //                 ...defaultMailOptions,
        //                 to: email,
        //                 subject: translation("Emails.emailAfterDeleteSubject")(locale),
        //                 html: htmlToSend,
        //             };
        //
        //             const [error, result] = await tryCatch(transporter.sendMail.bind(transporter))(mailOptions);
        //             if (error) throw new Error(`Failed to send email: ${error.message}`);
        //             return result;
        //         },
        //         emailAfterDeleteAgency: async ({ name, email }) => {
        //             const title = translation("Emails.emailAfterAgencyDeletionTitle")(locale);
        //             const content = translation("Emails.emailAfterAgencyDeletionContent", {
        //                 name,
        //                 email: process.env.ZOHO_EMAIL,
        //             })(locale);
        //
        //             const htmlToSend = template({
        //                 domain: domain,
        //                 title: title,
        //                 content: content,
        //             });
        //
        //             const mailOptions = {
        //                 ...defaultMailOptions,
        //                 to: email,
        //                 subject: translation("Emails.emailAfterDeleteSubject")(locale),
        //                 html: htmlToSend,
        //             };
        //
        //             const [error, result] = await tryCatch(transporter.sendMail.bind(transporter))(mailOptions);
        //             if (error) throw new Error(`Failed to send email: ${error.message}`);
        //             return result;
        //         },
        //         emailAfterVerifyClient: async ({ name, email }) => {
        //             const title = translation("Emails.heyName", { name })(locale);
        //             const content = translation("Emails.emailVerifyClientContent", { email })(locale);
        //
        //             const htmlToSend = template({
        //                 domain: domain,
        //                 title: title,
        //                 content: content,
        //             });
        //
        //             const mailOptions = {
        //                 ...defaultMailOptions,
        //                 to: email,
        //                 subject: translation("Emails.emailAfterClientSubject")(locale),
        //                 html: htmlToSend,
        //             };
        //
        //             const [error, result] = await tryCatch(transporter.sendMail.bind(transporter))(mailOptions);
        //             if (error) throw new Error(`Failed to send email: ${error.message}`);
        //             return result;
        //         },
        //         emailAfterVerifyAgency: async ({ name, email }) => {
        //             const title = translation("Emails.heyName", { name })(locale);
        //             const dashboardUrl = `${domain}/${locale}${ROUTE_URL.DASHBOARD_AGENCY}`;
        //             const dashboardAgencyPropertiesUrl = `${domain}/${locale}${ROUTE_URL.DASHBOARD_AGENCY_PROPERTIES}`;
        //             const supportEmail = process.env.ZOHO_EMAIL;
        //
        //             const content = translation("Emails.emailAfterAgencyVerifyContent", {
        //                 dashboardAgencyPropertiesUrl,
        //                 dashboardUrl,
        //                 supportEmail,
        //             })(locale);
        //
        //             const htmlToSend = template({
        //                 domain: domain,
        //                 title: title,
        //                 content: content,
        //             });
        //
        //             const mailOptions = {
        //                 ...defaultMailOptions,
        //                 to: email,
        //                 subject: translation("Emails.emailAfterAgencyVerifySubject")(locale),
        //                 html: htmlToSend,
        //             };
        //
        //             const [error, result] = await tryCatch(transporter.sendMail.bind(transporter))(mailOptions);
        //             if (error) throw new Error(`Failed to send email: ${error.message}`);
        //             return result;
        //         },
        //         emailAgencySubmissionDecline: async ({ email, name }) => {
        //             const title = translation("Emails.emailAfterAgencySubmissionDeclineTitle", { name })(locale);
        //             const routeUrl = `${domain}/${locale}${ROUTE_URL.UNAPPROVED_AGENCY}`;
        //             const supportEmail = process.env.ZOHO_EMAIL;
        //
        //             const content = translation("Emails.emailAfterAgencySubmissionDeclineContent", {
        //                 link: routeUrl,
        //                 supportEmail,
        //             })(locale);
        //
        //             const htmlToSend = template({
        //                 domain: domain,
        //                 title: title,
        //                 content: content,
        //             });
        //
        //             const mailOptions = {
        //                 ...defaultMailOptions,
        //                 to: email,
        //                 subject: translation("Emails.emailAfterAgencySubmissionDeclineSubject")(locale),
        //                 html: htmlToSend,
        //             };
        //
        //             const [error, result] = await tryCatch(transporter.sendMail.bind(transporter))(mailOptions);
        //             if (error) throw new Error(`Failed to send email: ${error.message}`);
        //             return result;
        //         },
        //         emailAgencySubmissionApprove: async ({ email, name }) => {
        //             const title = translation("Emails.emailAfterAgencySubmissionDeclineTitle", { name })(locale);
        //             const routeUrl = `${domain}/${locale}${ROUTE_URL.DASHBOARD_AGENCY}`;
        //             const supportEmail = process.env.ZOHO_EMAIL;
        //
        //             const content = translation("Emails.emailAfterAgencySubmissionApprove", {
        //                 name,
        //                 link: routeUrl,
        //                 supportEmail,
        //             })(locale);
        //
        //             const htmlToSend = template({
        //                 domain: domain,
        //                 title: title,
        //                 content: content,
        //             });
        //
        //             const mailOptions = {
        //                 ...defaultMailOptions,
        //                 to: email,
        //                 subject: translation("Emails.emailAfterAgencySubmissionApproveSubject")(locale),
        //                 html: htmlToSend,
        //             };
        //
        //             const [error, result] = await tryCatch(transporter.sendMail.bind(transporter))(mailOptions);
        //             if (error) throw new Error(`Failed to send email: ${error.message}`);
        //             return result;
        //         },
        //         emailAgencyPlanUpgrade: async ({ email, name, credits }) => {
        //             const title = translation("Emails.emailAfterAgencySubmissionDeclineTitle", { name })(locale);
        //             const content = translation("Emails.emailAfterAgencyPlanUpgrade", { credits })(locale);
        //
        //             const htmlToSend = template({
        //                 domain: domain,
        //                 title: title,
        //                 content: content,
        //             });
        //
        //             const mailOptions = {
        //                 ...defaultMailOptions,
        //                 to: email,
        //                 subject: translation("Emails.emailAfterAgencyPlanUpgradeSubject")(locale),
        //                 html: htmlToSend,
        //             };
        //
        //             const [error, result] = await tryCatch(transporter.sendMail.bind(transporter))(mailOptions);
        //             if (error) throw new Error(`Failed to send email: ${error.message}`);
        //             return result;
        //         },
    }
}
