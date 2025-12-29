/**
 * Creates HTML email template for agency contact form
 * @param {Object} data - Form data
 * @param {string} data.name - Contact name
 * @param {string} [data.email] - Contact email (optional)
 * @param {string} data.phone - Contact phone
 * @param {string} [data.subject] - Message subject (optional)
 * @param {string} [data.message] - Message content (optional)
 * @param {number} [data.propertyId] - Property ID (optional)
 * @param {string} [data.propertyUrl] - Property URL (optional)
 * @param {string} [data.propertyName] - Property name (optional)
 * @param {Object} agency - Agency information
 * @returns {string} HTML email content
 */
export function createContactEmailTemplate(data, agency) {
    const { name, email, phone, subject, message, propertyId, propertyUrl, propertyName } = data

    return `
<!DOCTYPE html>
<html lang="mk">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Нова порака од контакт форма</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background-color: #f4f4f4;
            padding: 20px;
            text-align: center;
            border-radius: 5px 5px 0 0;
        }
        .header h1 {
            margin: 0;
            color: #333;
            font-size: 24px;
        }
        .content {
            background-color: #ffffff;
            padding: 30px;
            border: 1px solid #ddd;
            border-top: none;
        }
        .field {
            margin-bottom: 20px;
        }
        .field-label {
            font-weight: bold;
            color: #555;
            display: block;
            margin-bottom: 5px;
        }
        .field-value {
            color: #333;
            padding: 10px;
            background-color: #f9f9f9;
            border-left: 3px solid #007bff;
            border-radius: 3px;
        }
        .footer {
            background-color: #f4f4f4;
            padding: 15px;
            text-align: center;
            border-radius: 0 0 5px 5px;
            font-size: 12px;
            color: #666;
        }
        .divider {
            height: 1px;
            background-color: #ddd;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Нова порака од контакт форма</h1>
    </div>
    <div class="content">
        <p>Добивте нова порака од контакт формата на вашата веб-страница</p>
        <div class="divider"></div>
        <div class="field">
            <span class="field-label">Име:</span>
            <div class="field-value">${name}</div>
        </div>
        ${
            email
                ? `
        <div class="field">
            <span class="field-label">Е-пошта:</span>
            <div class="field-value"><a href="mailto:${email}">${email}</a></div>
        </div>
        `
                : ""
        }
        <div class="field">
            <span class="field-label">Телефон:</span>
            <div class="field-value"><a href="tel:${phone}">${phone}</a></div>
        </div>
        ${
            subject
                ? `
        <div class="field">
            <span class="field-label">Наслов:</span>
            <div class="field-value">${subject}</div>
        </div>
        `
                : ""
        }

        ${
            message
                ? `
        <div class="field">
            <span class="field-label">Порака:</span>
            <div class="field-value">${message}</div>
        </div>
        `
                : ""
        }

        ${
            propertyId
                ? `
        <div class="field">
            <span class="field-label">Имот:</span>
            <div class="field-value">${
                propertyUrl
                    ? `<a href="${propertyUrl}" target="_blank" style="color: #007bff; text-decoration: none;">${propertyName ? propertyName : `#${propertyId}`}</a>`
                    : propertyName
                      ? `${propertyName} (#${propertyId})`
                      : `#${propertyId}`
            }</div>
        </div>
        `
                : ""
        }
    </div>
</body>
</html>
    `.trim()
}
