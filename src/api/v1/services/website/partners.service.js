/**
 * Agency Partners Service
 * Handles business logic for agency partner management
 * @module services/website/partners
 */

import prisma from "#database/client.js"
import createError from "http-errors"
import { invalidateCachePattern } from "#utils/cache/index.js"

/**
 * Verifies that a user is an active member of the specified agency
 * @param {string} userId - User ID to check
 * @param {string} agencyId - Agency ID to verify membership for
 * @throws {403} If user is not an active member of the agency
 */
async function verifyAgencyMembership(userId, agencyId) {
    const member = await prisma.agencyMember.findFirst({
        where: {
            userId,
            agencyId,
            status: "active",
        },
    })

    if (!member) {
        throw createError(403, "Not authorized to manage partners for this agency")
    }

    return member
}

/**
 * Get all partners for an agency
 * @param {string} agencyId - Agency ID
 * @returns {Promise<Array>} Array of partners sorted by sortOrder
 */
export async function getAgencyPartnersService(agencyId) {
    const partners = await prisma.agencyPartner.findMany({
        where: { agencyId },
        orderBy: { sortOrder: "asc" },
        select: {
            id: true,
            name: true,
            image: true,
            url: true,
            sortOrder: true,
            createdAt: true,
            updatedAt: true,
        },
    })

    return partners
}

/**
 * Create a new partner for an agency
 * @param {string} agencyId - Agency ID
 * @param {Object} partnerData - Partner data
 * @param {string} partnerData.name - Partner name
 * @param {Object} [partnerData.image] - Partner image URLs
 * @param {string} [partnerData.url] - Partner website URL
 * @param {number} [partnerData.sortOrder] - Sort order
 * @param {string} userId - User ID creating the partner
 * @returns {Promise<Object>} Created partner
 * @throws {403} If user is not authorized
 */
export async function createAgencyPartnerService(agencyId, partnerData, userId) {
    // Verify user is a member of the agency
    await verifyAgencyMembership(userId, agencyId)

    const partner = await prisma.agencyPartner.create({
        data: {
            agencyId,
            name: partnerData.name,
            image: partnerData.image || null,
            url: partnerData.url || null,
            sortOrder: partnerData.sortOrder ?? 0,
        },
    })

    // Invalidate agency configuration cache
    invalidateCachePattern("cache:getAgencyByReferer:")

    return partner
}

/**
 * Update an existing partner
 * @param {string} agencyId - Agency ID
 * @param {string} partnerId - Partner ID to update
 * @param {Object} partnerData - Updated partner data
 * @param {string} userId - User ID updating the partner
 * @returns {Promise<Object>} Updated partner
 * @throws {403} If user is not authorized
 * @throws {404} If partner not found or doesn't belong to agency
 */
export async function updateAgencyPartnerService(agencyId, partnerId, partnerData, userId) {
    // Verify user is a member of the agency
    await verifyAgencyMembership(userId, agencyId)

    // Verify partner belongs to this agency
    const existingPartner = await prisma.agencyPartner.findFirst({
        where: {
            id: partnerId,
            agencyId,
        },
    })

    if (!existingPartner) {
        throw createError(404, "Partner not found")
    }

    // Prepare update data
    const updateData = {}
    if (partnerData.name !== undefined) updateData.name = partnerData.name
    if (partnerData.image !== undefined) updateData.image = partnerData.image
    if (partnerData.url !== undefined) updateData.url = partnerData.url
    if (partnerData.sortOrder !== undefined) updateData.sortOrder = partnerData.sortOrder

    const updatedPartner = await prisma.agencyPartner.update({
        where: { id: partnerId },
        data: updateData,
    })

    // Invalidate agency configuration cache
    invalidateCachePattern("cache:getAgencyByReferer:")

    return updatedPartner
}

/**
 * Delete a partner
 * @param {string} agencyId - Agency ID
 * @param {string} partnerId - Partner ID to delete
 * @param {string} userId - User ID deleting the partner
 * @returns {Promise<Object>} Deleted partner
 * @throws {403} If user is not authorized
 * @throws {404} If partner not found or doesn't belong to agency
 */
export async function deleteAgencyPartnerService(agencyId, partnerId, userId) {
    // Verify user is a member of the agency
    await verifyAgencyMembership(userId, agencyId)

    // Verify partner belongs to this agency
    const existingPartner = await prisma.agencyPartner.findFirst({
        where: {
            id: partnerId,
            agencyId,
        },
    })

    if (!existingPartner) {
        throw createError(404, "Partner not found")
    }

    const deletedPartner = await prisma.agencyPartner.delete({
        where: { id: partnerId },
    })

    // Invalidate agency configuration cache
    invalidateCachePattern("cache:getAgencyByReferer:")

    return deletedPartner
}

/**
 * Bulk reorder partners
 * @param {string} agencyId - Agency ID
 * @param {Array<{id: string, sortOrder: number}>} reorderData - Array of partner IDs and their new sort orders
 * @param {string} userId - User ID performing the reorder
 * @returns {Promise<Array>} Updated partners
 * @throws {403} If user is not authorized
 * @throws {404} If any partner doesn't belong to agency
 */
export async function reorderAgencyPartnersService(agencyId, reorderData, userId) {
    // Verify user is a member of the agency
    await verifyAgencyMembership(userId, agencyId)

    // Verify all partners belong to this agency
    const partnerIds = reorderData.map((p) => p.id)
    const existingPartners = await prisma.agencyPartner.findMany({
        where: {
            id: { in: partnerIds },
            agencyId,
        },
        select: { id: true },
    })

    if (existingPartners.length !== partnerIds.length) {
        throw createError(404, "One or more partners not found")
    }

    // Update all partners in a transaction
    const updates = reorderData.map((partner) =>
        prisma.agencyPartner.update({
            where: { id: partner.id },
            data: { sortOrder: partner.sortOrder },
        })
    )

    const updatedPartners = await prisma.$transaction(updates)

    // Invalidate agency configuration cache
    invalidateCachePattern("cache:getAgencyByReferer:")

    return updatedPartners
}
