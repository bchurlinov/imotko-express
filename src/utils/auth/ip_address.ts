export const getIpAddress = request => {
    // Access headers with the correct method
    const xForwardedFor = request.get("x-forwarded-for") || request.headers["x-forwarded-for"]
    const connectionRemoteAddress = request.get("x-real-ip") || request.headers["x-real-ip"]

    // Access IP directly from the Express `request` object
    const ip = request.ip || request.connection?.remoteAddress

    // Return the first IP from the "x-forwarded-for" list or fallback to other options
    return xForwardedFor?.split(",")[0] || connectionRemoteAddress || ip || "Unknown"
}
