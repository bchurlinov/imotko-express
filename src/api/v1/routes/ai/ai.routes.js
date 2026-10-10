import { Router } from "express"
import prisma from "#database/client.js"
import { verifySupabaseToken } from "#middlewares/verifySupabaseToken.js"
import { createResolvePropertyWriter } from "#middlewares/resolve_property_writer.js"
import { createPropertyPrefillController } from "#controllers/ai/property_prefill.controller.js"
import { extractPropertyPrefill } from "#shared/ai/property_prefill/extract.js"

const router = Router()

// The LLM is reached only after the token, the DB-resolved actor and the body all pass (spec §3.1).
router.post(
    "/property-prefill",
    verifySupabaseToken,
    createResolvePropertyWriter({ db: prisma }),
    createPropertyPrefillController({ extract: extractPropertyPrefill })
)

export default router
