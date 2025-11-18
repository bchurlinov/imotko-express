export const getIpAddress = (request) => {
    // Access headers and ensure type safety
    const xForwardedFor = request.get("x-forwarded-for") || request.headers["x-forwarded-for"];
    const connectionRemoteAddress = request.get("x-real-ip") || request.headers["x-real-ip"];
    // Access IP directly from the Express `request` object
    const ip = request.ip || request.socket?.remoteAddress;
    // Return the first IP from the "x-forwarded-for" list or fallback to other options
    return xForwardedFor?.split(",")[0]?.trim() || connectionRemoteAddress || ip || "Unknown";
};
