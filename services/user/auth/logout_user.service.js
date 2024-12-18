import prisma from "#prisma/prisma.js"

export const logoutUserService = async refreshToken => {
    const currentUser = await prisma.user.findFirst({ where: { refreshToken } })

    if (!currentUser) return false

    await prisma.user.update({
        where: { email: currentUser.email },
        data: { refreshToken: null },
    })

    return true
}
