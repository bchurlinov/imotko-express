import express from "express"
import { supabaseAuthWebhookController } from "@controllers/auth/supabaseWebhook.controller.js"
import { asyncHandler } from "@/utils/helpers/async_handler.js"

const router = express.Router()

router.post("/supabase/hooks/auth", asyncHandler(supabaseAuthWebhookController))

export default router
