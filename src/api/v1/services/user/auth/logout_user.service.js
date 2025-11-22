import prisma from "../../../../../database/client.js"

/**
 * Service to logout a user
 * @param {string} refreshToken - The refresh token to invalidate
 * @returns {Promise<boolean>} True if logout was successful, false otherwise
 */
export const logoutUserService = async (refreshToken) => {
    const currentUser = await prisma.user.findFirst({ where: { refreshToken } })

    if (!currentUser) return false

    await prisma.user.update({
        where: { email: currentUser.email },
        data: { refreshToken: null },
    })

    return true
}
