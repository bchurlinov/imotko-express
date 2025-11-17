import prisma from "../../../../../database/client.js"

export const logoutUserService = async (refreshToken: any) => {
    const currentUser = await prisma.user.findFirst({ where: { refreshToken } })

    if (!currentUser) return false

    await prisma.user.update({
        where: { email: currentUser.email },
        data: { refreshToken: null },
    })

    return true
}
