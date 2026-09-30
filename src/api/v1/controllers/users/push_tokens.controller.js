import { chatResponse } from "#controllers/chat/chat_response.js"
import { registerPushToken, unregisterPushToken } from "#services/chat/chat_push.service.js"

export const registerPushTokenController = async (req, res) => {
    await registerPushToken({
        userId: req.chatViewer.userId,
        token: req.body.token,
        platform: req.body.platform,
        locale: req.body.locale,
    })
    return chatResponse(res, 200)
}

export const unregisterPushTokenController = async (req, res) => {
    await unregisterPushToken({ userId: req.chatViewer.userId, token: req.params.token })
    return chatResponse(res, 200)
}
