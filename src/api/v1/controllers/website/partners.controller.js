/**
 * Agency Partners Controller
 * Handles HTTP requests for agency partner management
 * @module controllers/website/partners
 */

import asyncHandler from "express-async-handler"
import { validationResult } from "express-validator"
import createError from "http-errors"
import {
    getAgencyPartnersService,
    createAgencyPartnerService,
    updateAgencyPartnerService,
    deleteAgencyPartnerService,
    reorderAgencyPartnersService,
} from "#services/website/partners.service.js"

/**
 * GET /api/v1/website/partners
 * Get all partners for an agency (identified by referer)
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export const getWebsitePartnersController = asyncHandler(async (req, res) => {
    const { agencyId } = req

    if (!agencyId) {
        throw createError(403, "Agency identification required")
    }

    const partners = await getAgencyPartnersService(agencyId)

    res.status(200).json({
        data: partners,
        code: 200,
        message: "Partners retrieved successfully",
    })
})

/**
 * POST /api/v1/website/partners
 * Create a new partner
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export const createWebsitePartnerController = asyncHandler(async (req, res) => {
    // Check validation results
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
        throw createError(400, JSON.stringify(errors.array()))
    }

    const { agencyId, user } = req
    const { name, image, url, sortOrder } = req.body

    if (!agencyId) {
        throw createError(403, "Agency identification required")
    }

    if (!user || !user.id) {
        throw createError(401, "Authentication required")
    }

    const partner = await createAgencyPartnerService(
        agencyId,
        { name, image, url, sortOrder },
        user.id
    )

    res.status(201).json({
        data: partner,
        code: 201,
        message: "Partner created successfully",
    })
})

/**
 * PUT /api/v1/website/partners/:partnerId
 * Update an existing partner
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export const updateWebsitePartnerController = asyncHandler(async (req, res) => {
    // Check validation results
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
        throw createError(400, JSON.stringify(errors.array()))
    }

    const { agencyId, user } = req
    const { partnerId } = req.params
    const { name, image, url, sortOrder } = req.body

    if (!agencyId) {
        throw createError(403, "Agency identification required")
    }

    if (!user || !user.id) {
        throw createError(401, "Authentication required")
    }

    const partner = await updateAgencyPartnerService(
        agencyId,
        partnerId,
        { name, image, url, sortOrder },
        user.id
    )

    res.status(200).json({
        data: partner,
        code: 200,
        message: "Partner updated successfully",
    })
})

/**
 * DELETE /api/v1/website/partners/:partnerId
 * Delete a partner
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export const deleteWebsitePartnerController = asyncHandler(async (req, res) => {
    const { agencyId, user } = req
    const { partnerId } = req.params

    if (!agencyId) {
        throw createError(403, "Agency identification required")
    }

    if (!user || !user.id) {
        throw createError(401, "Authentication required")
    }

    await deleteAgencyPartnerService(agencyId, partnerId, user.id)

    res.status(200).json({
        data: null,
        code: 200,
        message: "Partner deleted successfully",
    })
})

/**
 * PATCH /api/v1/website/partners/reorder
 * Bulk update sortOrder for multiple partners
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export const reorderWebsitePartnersController = asyncHandler(async (req, res) => {
    // Check validation results
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
        throw createError(400, JSON.stringify(errors.array()))
    }

    const { agencyId, user } = req
    const { partners } = req.body

    if (!agencyId) {
        throw createError(403, "Agency identification required")
    }

    if (!user || !user.id) {
        throw createError(401, "Authentication required")
    }

    const updatedPartners = await reorderAgencyPartnersService(agencyId, partners, user.id)

    res.status(200).json({
        data: updatedPartners,
        code: 200,
        message: "Partners reordered successfully",
    })
})
