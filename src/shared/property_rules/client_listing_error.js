// COPIED FROM imotko/src/lib/client_listings/client_listing_http.js (only: ClientListingError) by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).

export class ClientListingError extends Error {
    constructor(code, status, data = undefined) {
        super(code)
        this.name = "ClientListingError"
        this.code = code
        this.status = status
        this.data = data
    }
}
