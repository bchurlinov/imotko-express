import type { Request, Response, NextFunction } from "express"

export const supabaseAuthWebhookController = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        console.log("[Supabase Auth Hook]", {
            headers: req.headers,
            body: req.body,
        })

        res.status(200).json({ received: true })
    } catch (error) {
        next(error)
    }
}
