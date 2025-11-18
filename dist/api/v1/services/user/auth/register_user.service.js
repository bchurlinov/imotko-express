import { tokens } from "../../../../../utils/auth/index.js";
import { EmailTransporter } from "../../../../../modules/email_transporter/email_transporter.js";
import createError from "http-errors";
import prisma from "../../../../../database/client.js";
import bcrypt from "bcryptjs";
// TODO Add S3 URL when creating a new account
export const registerUserService = async (body) => {
    const { email, password, name, language, location, ipAddress } = body;
    if (!name || !password || !email)
        throw createError(401, "Name, email and password are required.");
    const existingUser = await prisma.user.findUnique({
        where: { email },
    });
    if (existingUser)
        throw createError(409, "userEmailExist");
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
            data: {
                email,
                name,
                hashedPassword,
                image: `${process.env.AWS_S3_URL}/user_avatar.svg`,
                language,
                location,
                ipAddress,
                role: "CLIENT",
            },
        });
        const client = await tx.client.upsert({
            where: {
                userId: user.id,
            },
            update: {},
            create: {
                user: {
                    connect: {
                        id: user.id,
                    },
                },
            },
            include: {
                user: true,
            },
        });
        await tx.user.update({
            where: {
                id: user.id,
            },
            data: {
                clientId: client.id,
            },
        });
        return user;
    });
    // TODO => Check the "redirect"
    // TODO => Add error scenario for the "result"
    const verificationToken = await tokens.generateVerificationToken(newUser.email);
    const emailTransporter = await EmailTransporter("mk");
    const result = await emailTransporter.sendVerificationEmail(verificationToken.email, verificationToken.token, "/");
    return newUser;
};
