import { Router } from "express"
import { param } from "express-validator"
import { validateRequest } from "#middlewares/validate_request.js"
import { clientListingsGuard } from "#middlewares/client_listings_guard.js"
import {
    bumpClientPropertyController,
    createClientPropertyController,
    deleteClientPropertyController,
    getClientPropertyController,
    listClientPropertiesController,
    setAgencyContactController,
    setClientPropertyVisibilityController,
    updateClientPropertyController,
} from "#controllers/client/client_properties.controller.js"
import { clientListingErrorResponder } from "#controllers/client/client_listing_response.js"

const router = Router()
const id = param("id").isString().trim().notEmpty().isLength({ max: 200 })
router.use(clientListingsGuard)
router.get("/properties", listClientPropertiesController)
router.get("/properties/:id", [id], validateRequest, getClientPropertyController)
router.post("/properties", createClientPropertyController)
router.put("/properties/:id", [id], validateRequest, updateClientPropertyController)
router.delete("/properties/:id", [id], validateRequest, deleteClientPropertyController)
router.patch("/properties/:id/visibility", [id], validateRequest, setClientPropertyVisibilityController)
router.patch("/properties/:id/agency-contact", [id], validateRequest, setAgencyContactController)
router.patch("/properties/:id/restart", [id], validateRequest, bumpClientPropertyController)
router.use(clientListingErrorResponder)
export default router
