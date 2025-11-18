export const supabaseAuthWebhookController = async (req, res, next) => {
    try {
        console.log("[Supabase Auth Hook]", {
            headers: req.headers,
            body: req.body,
        });
        res.status(200).json({ received: true });
    }
    catch (error) {
        next(error);
    }
};
