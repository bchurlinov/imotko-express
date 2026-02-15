/**
 * Creates HTML email template for agency property appraisal/valuation request
 * @param {Object} data - Form data
 * @param {string} data.name - Contact name
 * @param {string} [data.email] - Contact email (optional)
 * @param {string} data.phone - Contact phone
 * @param {string} [data.message] - Message content (optional)
 * @param {string} [data.location] - Property location (optional)
 * @param {number} [data.price] - Expected price (optional)
 * @param {string} [data.category] - Property category e.g. APARTMENT (optional)
 * @param {string} [data.propertyType] - Property type e.g. flat (optional)
 * @param {string} [data.helpWith] - What help is needed e.g. selling, buying, renting (optional)
 * @param {Object} agency - Agency information
 * @returns {string} HTML email content
 */
export function createAppraisalEmailTemplate(data, agency) {
    const { name, email, phone, message, location, price, category, propertyType, helpWith } = data

    const helpWithLabels = {
        selling: "Продажба",
        buying: "Купување",
        renting: "Изнајмување",
    }

    const helpWithLabel = helpWith ? (helpWithLabels[helpWith] ?? helpWith) : null

    const formattedPrice = price
        ? new Intl.NumberFormat("mk-MK", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(price)
        : null

    const receivedAt = new Date().toLocaleString("mk-MK", { timeZone: "Europe/Skopje" })

    const propertyRows = [
        helpWithLabel && { label: "Потреба", value: helpWithLabel },
        location && { label: "Локација", value: location },
        category && { label: "Поткатегорија", value: category },
        propertyType && { label: "Категорија", value: propertyType },
        formattedPrice && { label: "Очекувана цена", value: formattedPrice },
    ].filter(Boolean)

    // Font stack: Lato (loaded via @import for Apple Mail / iOS / Outlook.com / Thunderbird),
    // falls back to Trebuchet MS / Verdana / Arial for Gmail and Outlook desktop.
    const font = "'Lato', 'Trebuchet MS', Verdana, Tahoma, Arial, sans-serif"

    return `
<!DOCTYPE html>
<html lang="mk" xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Барање за проценка</title>
    <!--[if !mso]><!-->
    <style type="text/css">
        @import url('https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap');
    </style>
    <!--<![endif]-->
    <style type="text/css">
        body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
        a { text-decoration: none; }
        /* Prevent auto-linking on iOS */
        *[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
    </style>
</head>
<body style="margin:0;padding:0;background-color:#eef0f4;font-family:'Lato','Trebuchet MS',Verdana,Tahoma,Arial,sans-serif;">

<!-- Outer wrapper -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background-color:#eef0f4;padding:36px 16px;mso-cellspacing:0;">
    <tr>
        <td align="center" valign="top">

            <!-- Main card: 700px wide -->
            <table role="presentation" width="700" cellpadding="0" cellspacing="0" border="0"
                style="max-width:700px;width:100%;border-collapse:collapse;">

                <!-- ===== HEADER ===== -->
                <tr>
                    <td style="background-color:#16213e;border-radius:10px 10px 0 0;padding:32px 40px;
                                font-family:'Lato','Trebuchet MS',Verdana,Tahoma,Arial,sans-serif;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td valign="middle">
                                    <p style="margin:0 0 5px 0;font-size:11px;letter-spacing:2.5px;
                                               text-transform:uppercase;color:#7b82a0;
                                               font-family:'Lato','Trebuchet MS',Verdana,Arial,sans-serif;
                                               mso-line-height-rule:exactly;line-height:16px;">
                                        Нова порака
                                    </p>
                                    <h1 style="margin:0;font-size:26px;color:#ffffff;font-weight:700;
                                               letter-spacing:0.2px;
                                               font-family:'Lato','Trebuchet MS',Verdana,Arial,sans-serif;
                                               mso-line-height-rule:exactly;line-height:34px;">
                                        Клиент ви испрати порака
                                    </h1>
                                </td>
                                <td align="right" valign="middle" style="padding-left:16px;white-space:nowrap;">
                                    <span style="display:inline-block;background-color:#e8c96d;color:#16213e;
                                                 font-size:11px;font-weight:700;letter-spacing:1.5px;
                                                 text-transform:uppercase;padding:6px 14px;border-radius:20px;
                                                 font-family:'Lato','Trebuchet MS',Verdana,Arial,sans-serif;">
                                        Нова
                                    </span>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>

                <!-- ===== BODY ===== -->
                <tr>
                    <td style="background-color:#ffffff;padding:32px 40px;
                                border-left:1px solid #dce0e8;border-right:1px solid #dce0e8;
                                font-family:'Lato','Trebuchet MS',Verdana,Tahoma,Arial,sans-serif;">

                        <!-- Two-column layout: Contact | Divider | Details -->
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr valign="top">

                                <!-- ── Left: Contact ── -->
                                <td width="300" style="padding-right:18px;vertical-align:top;">
                                    <p style="margin:0 0 14px 0;font-size:10px;letter-spacing:2px;
                                               text-transform:uppercase;color:#9ca3af;
                                               font-family:'Lato','Trebuchet MS',Verdana,Arial,sans-serif;
                                               mso-line-height-rule:exactly;line-height:14px;">
                                        Контакт
                                    </p>

                                    <!-- Name -->
                                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                                        style="margin-bottom:10px;">
                                        <tr>
                                            <td style="background-color:#f5f7fa;border-radius:7px;padding:12px 14px;
                                                        border-left:3px solid #e8c96d;">
                                                <p style="margin:0 0 3px 0;font-size:10px;color:#9ca3af;
                                                           text-transform:uppercase;letter-spacing:1px;
                                                           font-family:'Lato','Trebuchet MS',Verdana,Arial,sans-serif;
                                                           mso-line-height-rule:exactly;line-height:14px;">
                                                    Име
                                                </p>
                                                <p style="margin:0;font-size:16px;color:#16213e;font-weight:700;
                                                           font-family:'Lato','Trebuchet MS',Verdana,Arial,sans-serif;
                                                           mso-line-height-rule:exactly;line-height:22px;">
                                                    ${name}
                                                </p>
                                            </td>
                                        </tr>
                                    </table>

                                    <!-- Phone -->
                                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                                        style="margin-bottom:10px;">
                                        <tr>
                                            <td style="background-color:#f5f7fa;border-radius:7px;padding:12px 14px;
                                                        border-left:3px solid #e8c96d;">
                                                <p style="margin:0 0 3px 0;font-size:10px;color:#9ca3af;
                                                           text-transform:uppercase;letter-spacing:1px;
                                                           font-family:'Lato','Trebuchet MS',Verdana,Arial,sans-serif;
                                                           mso-line-height-rule:exactly;line-height:14px;">
                                                    Телефон
                                                </p>
                                                <a href="tel:${phone}"
                                                   style="font-size:16px;color:#16213e;font-weight:700;text-decoration:none;
                                                          font-family:'Lato','Trebuchet MS',Verdana,Arial,sans-serif;
                                                          mso-line-height-rule:exactly;line-height:22px;">
                                                    ${phone}
                                                </a>
                                            </td>
                                        </tr>
                                    </table>

                                    ${
                                        email
                                            ? `
                                    <!-- Email -->
                                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                        <tr>
                                            <td style="background-color:#f5f7fa;border-radius:7px;padding:12px 14px;
                                                        border-left:3px solid #e8c96d;">
                                                <p style="margin:0 0 3px 0;font-size:10px;color:#9ca3af;
                                                           text-transform:uppercase;letter-spacing:1px;
                                                           font-family:'Lato','Trebuchet MS',Verdana,Arial,sans-serif;
                                                           mso-line-height-rule:exactly;line-height:14px;">
                                                    Е-пошта
                                                </p>
                                                <a href="mailto:${email}"
                                                   style="font-size:15px;color:#4a6cf7;text-decoration:none;word-break:break-all;
                                                          font-family:'Lato','Trebuchet MS',Verdana,Arial,sans-serif;
                                                          mso-line-height-rule:exactly;line-height:21px;">
                                                    ${email}
                                                </a>
                                            </td>
                                        </tr>
                                    </table>
                                    `
                                            : ""
                                    }
                                </td>

                                <!-- ── Vertical divider (18px spacer + 1px line + 18px spacer) ── -->
                                <td width="1" style="background-color:#e4e7ec;font-size:0;line-height:0;">&nbsp;</td>
                                <td width="18" style="font-size:0;line-height:0;">&nbsp;</td>

                                <!-- ── Right: Property details ── -->
                                <td style="vertical-align:top;padding-left:0;">
                                    <p style="margin:0 0 14px 0;font-size:10px;letter-spacing:2px;
                                               text-transform:uppercase;color:#9ca3af;
                                               font-family:'Lato','Trebuchet MS',Verdana,Arial,sans-serif;
                                               mso-line-height-rule:exactly;line-height:14px;">
                                        Детали
                                    </p>

                                    ${
                                        propertyRows.length > 0
                                            ? propertyRows
                                                  .map(
                                                      row => `
                                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                                        style="margin-bottom:10px;">
                                        <tr>
                                            <td style="background-color:#f5f7fa;border-radius:7px;padding:12px 14px;
                                                        border-left:3px solid #b8c0cc;">
                                                <p style="margin:0 0 3px 0;font-size:10px;color:#9ca3af;
                                                           text-transform:uppercase;letter-spacing:1px;
                                                           font-family:'Lato','Trebuchet MS',Verdana,Arial,sans-serif;
                                                           mso-line-height-rule:exactly;line-height:14px;">
                                                    ${row.label}
                                                </p>
                                                <p style="margin:0;font-size:16px;color:#16213e;font-weight:700;
                                                           font-family:'Lato','Trebuchet MS',Verdana,Arial,sans-serif;
                                                           mso-line-height-rule:exactly;line-height:22px;">
                                                    ${row.value}
                                                </p>
                                            </td>
                                        </tr>
                                    </table>
                                    `
                                                  )
                                                  .join("")
                                            : `
                                    <p style="font-size:15px;color:#9ca3af;font-style:italic;margin:0;
                                               font-family:'Lato','Trebuchet MS',Verdana,Arial,sans-serif;">
                                        Нема дополнителни детали
                                    </p>`
                                    }
                                </td>

                            </tr>
                        </table>

                        ${
                            message
                                ? `
                        <!-- ── Message ── -->
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                            style="margin-top:24px;">
                            <tr>
                                <td style="border-top:1px solid #e4e7ec;padding-top:24px;">
                                    <p style="margin:0 0 12px 0;font-size:10px;letter-spacing:2px;
                                               text-transform:uppercase;color:#9ca3af;
                                               font-family:'Lato','Trebuchet MS',Verdana,Arial,sans-serif;
                                               mso-line-height-rule:exactly;line-height:14px;">
                                        Порака
                                    </p>
                                    <p style="margin:0;font-size:16px;color:#374151;
                                               mso-line-height-rule:exactly;line-height:26px;
                                               font-family:'Lato','Trebuchet MS',Verdana,Arial,sans-serif;">
                                        ${message}
                                    </p>
                                </td>
                            </tr>
                        </table>
                        `
                                : ""
                        }

                    </td>
                </tr>

                <!-- ===== FOOTER ===== -->
                <tr>
                    <td style="background-color:#16213e;border-radius:0 0 10px 10px;padding:16px 40px;
                                font-family:'Lato','Trebuchet MS',Verdana,Tahoma,Arial,sans-serif;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td valign="middle">
                                    <p style="margin:0;font-size:13px;color:#7b82a0;
                                               font-family:'Lato','Trebuchet MS',Verdana,Arial,sans-serif;
                                               mso-line-height-rule:exactly;line-height:18px;">
                                        Примено: ${receivedAt}
                                    </p>
                                </td>
                                ${
                                    agency?.name
                                        ? `
                                <td align="right" valign="middle">
                                    <p style="margin:0;font-size:13px;color:#7b82a0;
                                               font-family:'Lato','Trebuchet MS',Verdana,Arial,sans-serif;
                                               mso-line-height-rule:exactly;line-height:18px;">
                                        ${agency.name}
                                    </p>
                                </td>
                                `
                                        : ""
                                }
                            </tr>
                        </table>
                    </td>
                </tr>

            </table>
            <!-- /Main card -->

        </td>
    </tr>
</table>
<!-- /Outer wrapper -->

</body>
</html>
    `.trim()
}
