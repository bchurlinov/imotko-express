// COPIED FROM imotko/src/utils/isEmpty.js by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).

export const _isEmpty = val => val == null || !(Object.keys(val) || val).length
