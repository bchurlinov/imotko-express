const escapeHtml = value =>
    String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;")

/**
 * Creates HTML email template for mobile app contact requests
 * @param {Object} data - Form data
 * @param {string} data.helpType - Requested help type
 * @param {string} data.category - Property category
 * @param {number} data.price - Requested price
 * @param {string} data.location - Property location
 * @param {string} data.name - Contact name
 * @param {string} data.email - Contact email
 * @param {string} data.phone - Contact phone
 * @param {string} data.message - Contact message
 * @returns {string} HTML email content
 */
export function createContactRequestEmailTemplate(data) {
    const { helpType, category, price, location, name, email, phone, message } = data

    const formattedPrice = new Intl.NumberFormat("mk-MK", {
        minimumFractionDigits: Number.isInteger(price) ? 0 : 2,
        maximumFractionDigits: 2,
    }).format(price)

    const receivedAt = new Date().toLocaleString("mk-MK", { timeZone: "Europe/Skopje" })

    return `
<!DOCTYPE html>
<html lang="mk">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ново барање од мобилна апликација</title>
    <style>
        body {
            margin: 0;
            padding: 24px;
            background-color: #eef0f4;
            font-family: Arial, sans-serif;
            color: #1f2937;
        }
        .card {
            max-width: 720px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            border: 1px solid #d9dee8;
        }
        .header {
            background-color: #16213e;
            padding: 28px 32px;
            color: #ffffff;
        }
        .eyebrow {
            margin: 0 0 8px;
            font-size: 12px;
            letter-spacing: 1.8px;
            text-transform: uppercase;
            color: #d4b257;
        }
        .title {
            margin: 0;
            font-size: 28px;
            line-height: 1.2;
        }
        .content {
            padding: 32px;
        }
        .intro {
            margin: 0 0 24px;
            font-size: 15px;
            line-height: 1.6;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
        }
        .field {
            background-color: #f7f9fc;
            border-left: 4px solid #d4b257;
            border-radius: 8px;
            padding: 14px 16px;
        }
        .field.full {
            grid-column: 1 / -1;
        }
        .label {
            display: block;
            margin-bottom: 6px;
            font-size: 11px;
            letter-spacing: 1.2px;
            text-transform: uppercase;
            color: #6b7280;
            font-weight: 700;
        }
        .value {
            margin: 0;
            font-size: 16px;
            line-height: 1.5;
            color: #111827;
            word-break: break-word;
        }
        .value a {
            color: #1d4ed8;
            text-decoration: none;
        }
        .footer {
            padding: 0 32px 28px;
            color: #6b7280;
            font-size: 13px;
        }
        @media (max-width: 640px) {
            body {
                padding: 12px;
            }
            .content,
            .footer,
            .header {
                padding-left: 20px;
                padding-right: 20px;
            }
            .grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="header">
            <p class="eyebrow">Mobile App Inquiry</p>
            <h1 class="title">Ново барање од мобилна апликација</h1>
        </div>
        <div class="content">
            <p class="intro">Испратено е ново јавно барање од мобилната апликација на Imotko.</p>
            <div class="grid">
                <div class="field">
                    <span class="label">Потреба</span>
                    <p class="value">${escapeHtml(helpType)}</p>
                </div>
                <div class="field">
                    <span class="label">Категорија</span>
                    <p class="value">${escapeHtml(category)}</p>
                </div>
                <div class="field">
                    <span class="label">Цена</span>
                    <p class="value">${escapeHtml(formattedPrice)}</p>
                </div>
                <div class="field">
                    <span class="label">Локација</span>
                    <p class="value">${escapeHtml(location)}</p>
                </div>
                <div class="field">
                    <span class="label">Име</span>
                    <p class="value">${escapeHtml(name)}</p>
                </div>
                <div class="field">
                    <span class="label">Телефон</span>
                    <p class="value"><a href="tel:${escapeHtml(phone)}">${escapeHtml(phone)}</a></p>
                </div>
                <div class="field full">
                    <span class="label">Е-пошта</span>
                    <p class="value"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
                </div>
                <div class="field full">
                    <span class="label">Порака</span>
                    <p class="value">${escapeHtml(message).replaceAll("\n", "<br />")}</p>
                </div>
            </div>
        </div>
        <div class="footer">
            Примено на: ${escapeHtml(receivedAt)}
        </div>
    </div>
</body>
</html>
    `.trim()
}
