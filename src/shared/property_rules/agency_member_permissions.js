// COPIED FROM imotko/src/lib/permissions/agency_member_permissions.js by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).
import { AgencyMemberRole } from "#generated/prisma/enums.ts"

const PERMISSION = {
    // View
    VIEW_CRM: "view_crm",
    VIEW_OVERVIEW: "view_overview",
    VIEW_PROPERTIES: "view_properties",
    VIEW_PROPERTY_INTERACTIONS: "view_property_interactions",
    VIEW_ANALYTICS: "view_property_analytics",
    VIEW_PROPERTY_OFFERS: "view_property_offers",
    VIEW_PROPERTY_ESTIMATIONS: "view_property_estimations",
    VIEW_MESSAGES: "view_messages",
    // WRITE
    WRITE_PROPERTIES: "write_properties",
    WRITE_MESSAGES: "write_messages",
    WRITE_PROPERTY_OFFERS: "write_property_offers",
    WRITE_PROPERTY_ESTIMATIONS: "write_property_estimations",
    WRITE_MEMBERS: "write_invite_members",
    WRITE_CLIENTS: "write_clients",
    WRITE_AGENCY: "write_agency",
    WRITE_PROPERTY_PROMOTE: "write_property_promote",
    MANAGE_CONNECTORS: "manage_connectors",
    // DELETE
    DELETE_PROPERTIES: "delete_properties",
    DELETE_MESSAGES: "delete_messages",
    DELETE_MEMBERS: "delete_members",
    DELETE_CLIENTS: "delete_clients",
    DELETE_AGENCY: "delete_agency",
}

const ROLE_PERMISSIONS = {}

// Viewer
ROLE_PERMISSIONS[AgencyMemberRole.viewer] = [
    PERMISSION.VIEW_OVERVIEW,
    PERMISSION.VIEW_PROPERTY_INTERACTIONS,
    PERMISSION.VIEW_PROPERTY_OFFERS,
    PERMISSION.VIEW_PROPERTY_ESTIMATIONS,
    PERMISSION.VIEW_MESSAGES,
]
// Collaborator
ROLE_PERMISSIONS[AgencyMemberRole.collaborator] = [
    ...ROLE_PERMISSIONS[AgencyMemberRole.viewer],
    PERMISSION.WRITE_PROPERTIES,
    PERMISSION.VIEW_ANALYTICS,
    PERMISSION.WRITE_MESSAGES,
]
// Agent
ROLE_PERMISSIONS[AgencyMemberRole.agent] = [
    ...ROLE_PERMISSIONS[AgencyMemberRole.collaborator],
    PERMISSION.VIEW_CRM,
    PERMISSION.WRITE_CLIENTS,
]
// Manager
ROLE_PERMISSIONS[AgencyMemberRole.manager] = [
    ...ROLE_PERMISSIONS[AgencyMemberRole.collaborator],
    PERMISSION.WRITE_PROPERTY_OFFERS,
    PERMISSION.WRITE_PROPERTY_ESTIMATIONS,
    PERMISSION.VIEW_CRM,
    PERMISSION.WRITE_CLIENTS,
    PERMISSION.DELETE_CLIENTS,
    PERMISSION.WRITE_AGENCY,
    PERMISSION.WRITE_PROPERTY_PROMOTE,
    PERMISSION.DELETE_PROPERTIES,
    PERMISSION.DELETE_MESSAGES,
    PERMISSION.MANAGE_CONNECTORS,
]
// Admin
ROLE_PERMISSIONS[AgencyMemberRole.admin] = [
    ...ROLE_PERMISSIONS[AgencyMemberRole.manager],
    PERMISSION.WRITE_MEMBERS,
    PERMISSION.DELETE_MEMBERS,
    PERMISSION.DELETE_AGENCY,
]

const hasPermission = (role, permission) => ROLE_PERMISSIONS[role]?.includes(permission) ?? false

// A feature is locked when it declares a permission the current role does not hold.
// `permission` of null/undefined means the feature is always available.
const isFeatureLocked = (role, permission) => !!permission && !hasPermission(role, permission)

const CheckPermissions = role => {
    return Object.freeze({
        canCreateProperty: () => hasPermission(role, PERMISSION.WRITE_PROPERTIES),
        canEditProperty: () => hasPermission(role, PERMISSION.WRITE_PROPERTIES),
        canSendEstimations: () => hasPermission(role, PERMISSION.WRITE_PROPERTY_ESTIMATIONS),
        canViewCrm: () => hasPermission(role, PERMISSION.VIEW_CRM),
        canDeleteProperty: () => hasPermission(role, PERMISSION.DELETE_PROPERTIES),
        canDeleteMessages: () => hasPermission(role, PERMISSION.DELETE_MESSAGES),
        canCreateClient: () => hasPermission(role, PERMISSION.WRITE_CLIENTS),
        canDeleteClient: () => hasPermission(role, PERMISSION.DELETE_CLIENTS),
        canCreateMember: () => hasPermission(role, PERMISSION.WRITE_MEMBERS),
        canDeleteMember: () => hasPermission(role, PERMISSION.DELETE_MEMBERS),
        canWriteAgency: () => hasPermission(role, PERMISSION.WRITE_AGENCY),
        canDeleteAgency: () => hasPermission(role, PERMISSION.DELETE_AGENCY),
    })
}

export { hasPermission, isFeatureLocked, CheckPermissions, ROLE_PERMISSIONS, PERMISSION }
