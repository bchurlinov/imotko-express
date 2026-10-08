import { Router } from "express"
import { param } from "express-validator"
import { validateRequest } from "#middlewares/validate_request.js"
import { clientListingsGuard } from "#middlewares/client_listings_guard.js"
import {
    getClientPropertyController,
    listClientPropertiesController,
} from "#controllers/client/client_properties.controller.js"
import { clientListingErrorResponder } from "#controllers/client/client_listing_response.js"

const router = Router()
const id = param("id").isString().trim().notEmpty().isLength({ max: 200 })
router.use(clientListingsGuard)
router.get("/properties", listClientPropertiesController)
router.get("/properties/:id", [id], validateRequest, getClientPropertyController)
router.use(clientListingErrorResponder)
export default router
