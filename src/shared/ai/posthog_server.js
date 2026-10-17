import { PostHog } from "posthog-node"

// Express counterpart of the web's server client: copied AI observability and conversion events use it. Railway runs one long-lived
// process, so the client batches normally; flushes are fire-and-forget.
let client

const isEnabled = env => env.NODE_ENV === "production" || env.POSTHOG_ENABLE_DEV === "true"

export const getPosthogServerClient = (env = process.env) => {
    if (client !== undefined) return client
    const token = env.POSTHOG_PROJECT_TOKEN
    const host = env.POSTHOG_HOST
    client = token && host && isEnabled(env) ? new PostHog(token, { host }) : null
    return client
}

export const flushInBackground = () => {
    const posthog = getPosthogServerClient()
    if (!posthog) return
    posthog.flush().catch(error => console.error("[posthog] flush failed", error))
}

// Same shape as the web's captureServerEvent. Express events carry no `web_` prefix; `app_surface` tells them apart.
export const captureServerEvent = ({ distinctId, event, properties = {} }) => {
    const posthog = getPosthogServerClient()
    if (!posthog || !distinctId) return

    posthog.capture({ distinctId, event, properties: { app_surface: "api", ...properties } })
    flushInBackground()
}

// Specs inject a fake client (or null to simulate a missing token).
export const setPosthogServerClientForTests = fake => {
    client = fake
}
