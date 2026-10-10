import createError from "http-errors"
import { AgencyMemberStatus, UserRole } from "#generated/prisma/enums.ts"
import { hasPermission, PERMISSION } from "#shared/property_rules/agency_member_permissions.js"
import { PREFILL_ACTOR } from "#shared/ai/property_prefill/field_sets.js"

// Who may prefill a listing. The agency always comes from the DB, never from the request (spec §3.1).
export const createResolvePropertyWriter =
    ({ db }) =>
    async (req, res, next) => {
        try {
            const user = await db.user.findUnique({
                where: { supabaseUserId: req.user.id },
                select: { id: true, role: true, clientId: true },
            })
            if (!user) return next(createError(403, "forbidden"))

            if (user.role === UserRole.ADMIN) {
                req.actor = { kind: PREFILL_ACTOR.ADMIN, userId: user.id }
                return next()
            }

            const member = await db.agencyMember.findFirst({
                where: { userId: user.id, status: AgencyMemberStatus.active },
                select: { agencyId: true, role: true },
            })
            if (member && hasPermission(member.role, PERMISSION.WRITE_PROPERTIES)) {
                req.actor = { kind: PREFILL_ACTOR.AGENCY, userId: user.id, agencyId: member.agencyId }
                return next()
            }

            // Clients only through apps that declare client listings (mobile); the web shows the button to agencies.
            if (user.clientId && req.capabilities?.clientListings) {
                req.actor = { kind: PREFILL_ACTOR.CLIENT, userId: user.id, clientId: user.clientId }
                return next()
            }

            return next(createError(403, "forbidden"))
        } catch (error) {
            return next(error)
        }
    }
