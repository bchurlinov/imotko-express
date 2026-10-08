// COPIED FROM imotko/src/utils/error_formatter.js by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).

export const formattedErrors = errors =>
    errors.reduce((acc, curr) => {
        acc[curr.path] = curr.message
        return acc
    }, {})

export const formatErrorMessages = errors =>
    Object.keys(errors).map(key => {
        return {
            name: key,
            type: "manual",
            message: errors[key],
        }
    })
