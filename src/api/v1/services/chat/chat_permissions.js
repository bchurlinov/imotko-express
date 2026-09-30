import { AgencyMemberRole } from "#generated/prisma/enums.ts"

export const CHAT_PERMISSION = Object.freeze({
    READ: "read",
    WRITE: "write",
    BLOCK: "block",
    REMOVE: "remove",
    VIEW_CRM: "viewCrm",
    MANAGE_EMAIL: "manageEmail",
})

const WRITER_ROLES = new Set([
    AgencyMemberRole.collaborator,
    AgencyMemberRole.agent,
    AgencyMemberRole.manager,
    AgencyMemberRole.admin,
])
const MANAGER_ROLES = new Set([AgencyMemberRole.manager, AgencyMemberRole.admin])

export const hasChatPermission = (role, permission) => {
    if (!Object.values(AgencyMemberRole).includes(role)) return false
    if (permission === CHAT_PERMISSION.READ) return true
    if (permission === CHAT_PERMISSION.WRITE || permission === CHAT_PERMISSION.BLOCK) return WRITER_ROLES.has(role)
    if (permission === CHAT_PERMISSION.VIEW_CRM) return role !== AgencyMemberRole.viewer
    if (permission === CHAT_PERMISSION.REMOVE || permission === CHAT_PERMISSION.MANAGE_EMAIL) {
        return MANAGER_ROLES.has(role)
    }
    return false
}

export const canRemoveConversation = viewer =>
    viewer?.type === "client" || (viewer?.type === "agency" && hasChatPermission(viewer.role, CHAT_PERMISSION.REMOVE))
