import { Request } from "express"

export const getIpAddress = (request: Request): string => {
    // Access headers and ensure type safety
    const xForwardedFor: string | undefined =
        request.get("x-forwarded-for") || (request.headers["x-forwarded-for"] as string | undefined)
    const connectionRemoteAddress: string | undefined =
        request.get("x-real-ip") || (request.headers["x-real-ip"] as string | undefined)

    // Access IP directly from the Express `request` object
    const ip: string | undefined = request.ip || request.socket?.remoteAddress

    // Return the first IP from the "x-forwarded-for" list or fallback to other options
    return xForwardedFor?.split(",")[0]?.trim() || connectionRemoteAddress || ip || "Unknown"
}
