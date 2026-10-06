import { AgencyApprovalStatus, PropertyStatus, UserRole } from "#generated/prisma/enums.ts"

/**
 * Express copy of imotko/src/lib/client_listings/retire.js — keep the two in sync.
 * Runs inside the account-deletion transaction, before the user (and, by cascade, the client) is deleted.
 * Property.clientId is onDelete: Restrict, so skipping this makes the deletion fail instead of leaving a listing
 * without an owner.
 * @param {import('#generated/prisma/client.ts').Prisma.TransactionClient} tx - Transaction client
 * @param {{ userId: string, clientId: string | null }} ids - The account being deleted
 * @returns {Promise<{ listings: number, agencyRequests: number }>}
 */
export const retireClientAccount = async (tx, { userId, clientId }) => {
    const listings = clientId
        ? await tx.property.updateMany({
              where: { clientId },
              data: { status: PropertyStatus.DELETED, autoRenewEnabled: false, clientId: null },
          })
        : { count: 0 }

    // An open "Стани агенција" request (agency owned by a person who is still a CLIENT), decision 122a.
    const agencyRequests = await tx.agency.deleteMany({
        where: {
            ownerId: userId,
            status: { in: [AgencyApprovalStatus.PENDING, AgencyApprovalStatus.DECLINED] },
            agencyOwner: { role: UserRole.CLIENT },
        },
    })

    return { listings: listings.count, agencyRequests: agencyRequests.count }
}
