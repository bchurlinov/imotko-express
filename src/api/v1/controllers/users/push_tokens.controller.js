import { chatResponse } from "#controllers/chat/chat_response.js"
import { parseAppVersion } from "#middlewares/client_capabilities.js"
import { registerPushToken, unregisterPushToken } from "#services/chat/chat_push.service.js"

export const pushTokenAppVersion = req => {
    const client = String(req.get("X-Imotko-Client") || "")
        .trim()
        .toLowerCase()
    const version = String(req.get("X-Imotko-App-Version") || "").trim()
    return client === "mobile" && parseAppVersion(version) ? version : null
}

export const registerPushTokenController = async (req, res) => {
    await registerPushToken({
        userId: req.chatViewer.userId,
        token: req.body.token,
        platform: req.body.platform,
        locale: req.body.locale,
        appVersion: pushTokenAppVersion(req),
    })
    return chatResponse(res, 200)
}

export const unregisterPushTokenController = async (req, res) => {
    await unregisterPushToken({ userId: req.chatViewer.userId, token: req.params.token })
    return chatResponse(res, 200)
}
