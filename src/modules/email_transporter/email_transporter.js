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
