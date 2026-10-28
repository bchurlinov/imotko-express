import { AgencyApprovalStatus, UserRole } from "#generated/prisma/enums.ts"

/**
 * Express copy of imotko/src/lib/agency/member_deletion.js — keep the two in sync.
 * An agency this user still owns; deleting them would leave it without an owner, so callers refuse the deletion.
 * A CLIENT's open "Стани агенција" request is left out: retireClientAccount removes it in the deletion transaction.
 * Agency.owner is the legacy owner column, ownerId the FK.
 * @param {import('#generated/prisma/client.ts').Prisma.TransactionClient} tx - Prisma client or transaction client
 * @param {string} userId - The account being deleted
 * @returns {Promise<{ id: string, name: string } | null>}
 */
export const findOwnedAgency = (tx, userId) =>
    tx.agency.findFirst({
        where: {
            OR: [{ ownerId: userId }, { owner: userId }],
            status: { not: AgencyApprovalStatus.DELETED },
            NOT: {
                status: { in: [AgencyApprovalStatus.PENDING, AgencyApprovalStatus.DECLINED] },
                agencyOwner: { role: UserRole.CLIENT },
            },
        },
        select: { id: true, name: true },
    })

/**
 * AgencyClientNotes.createdById is onDelete: Restrict and the notes are agency data, so a member's notes move to the
 * agency owner before the user (and, by cascade, the AgencyMember row) is deleted. Without an owner member the
 * deletion fails loudly on the Restrict instead of silently dropping notes.
 * @param {import('#generated/prisma/client.ts').Prisma.TransactionClient} tx - Transaction client
 * @param {string} userId - The account being deleted
 * @returns {Promise<{ agencyId: string | null, notes: number }>}
 */
export const handOverMemberNotes = async (tx, userId) => {
    const member = await tx.agencyMember.findUnique({
        where: { userId },
        select: { id: true, agencyId: true, agency: { select: { ownerId: true } } },
    })
    if (!member) return { agencyId: null, notes: 0 }

    const ownerMember = member.agency?.ownerId
        ? await tx.agencyMember.findUnique({ where: { userId: member.agency.ownerId }, select: { id: true } })
        : null
    if (!ownerMember || ownerMember.id === member.id) return { agencyId: member.agencyId, notes: 0 }

    const notes = await tx.agencyClientNotes.updateMany({
        where: { createdById: member.id },
        data: { createdById: ownerMember.id },
    })

    return { agencyId: member.agencyId, notes: notes.count }
}
