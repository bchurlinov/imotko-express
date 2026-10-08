import { Router } from "express"
import { param } from "express-validator"
import { validateRequest } from "#middlewares/validate_request.js"
import { clientListingsGuard } from "#middlewares/client_listings_guard.js"
import {
    deleteImageController,
    rotateImageController,
    uploadFiles,
    uploadImagesController,
} from "#controllers/uploads/uploads.controller.js"
import { clientListingErrorResponder } from "#controllers/client/client_listing_response.js"

const router = Router()

router.use(clientListingsGuard)
router.post("/", uploadFiles, uploadImagesController)
router.patch("/rotate", rotateImageController)
router.delete("/:id", [param("id").isString().trim().notEmpty().isLength({ max: 200 })], validateRequest, deleteImageController)
router.use(clientListingErrorResponder)

export default router
