import fs from "node:fs"
import path from "node:path"
import Handlebars from "handlebars"

const footerPath = () => path.join(process.cwd(), "src/messages/email/partials/imotko_footer.hbs")
let footerTemplate

const getFooterTemplate = () => {
    if (!footerTemplate) footerTemplate = Handlebars.compile(fs.readFileSync(footerPath(), "utf8"))
    return footerTemplate
}

// Same footer as the web app's emails. unsubscribe = { text, label, link } adds the "turn off automatic emails" line.
export const appendImotkoEmailFooter = (html, { unsubscribe } = {}) => {
    if (typeof html !== "string" || html.includes('data-imotko-footer="true"')) return html
    const footer = getFooterTemplate()({ unsubscribe })
    return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${footer}\n</body>`) : `${html}${footer}`
}
