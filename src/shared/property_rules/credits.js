// COPIED FROM imotko/src/lib/client_listings/credits.js by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).

// Same pattern as spendAgencyCredits: the balance check is part of the UPDATE, so parallel requests cannot push it
// below zero. Returns false when nothing was taken.
export const spendClientCredits = async (tx, clientId, amount) => {
    if (!Number.isInteger(amount) || amount <= 0) return false
    const { count } = await tx.client.updateMany({
        where: { id: clientId, credits: { gte: amount } },
        data: { credits: { decrement: amount } },
    })
    return count === 1
}
