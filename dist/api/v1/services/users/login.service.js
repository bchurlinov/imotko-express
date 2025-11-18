import createError from "http-errors";
import prisma from "@/database/client.js";
import { createSupabaseClient } from "@/utils/supabaseClient.js";
import { UserLanguage, UserRole } from "@/generated/prisma/index.js";
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const ensureString = (value) => typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
const isEnumValue = (enumObject, value) => typeof value === "string" && Object.values(enumObject).includes(value);
const resolveRole = (...candidates) => {
    for (const candidate of candidates) {
        const upperCandidate = typeof candidate === "string" ? candidate.toUpperCase() : undefined;
        if (isEnumValue(UserRole, upperCandidate))
            return upperCandidate;
    }
    return UserRole.CLIENT;
};
const resolveLanguage = (candidate) => {
    if (typeof candidate !== "string")
        return undefined;
    const upperCandidate = candidate.toUpperCase();
    return isEnumValue(UserLanguage, upperCandidate) ? upperCandidate : undefined;
};
const buildUserName = (metadata, fallbackEmail) => {
    const metadataName = ensureString(metadata.name);
    const firstName = ensureString(metadata.firstName);
    const lastName = ensureString(metadata.lastName);
    const derivedName = metadataName ??
        ([firstName, lastName]
            .filter((part) => typeof part === "string")
            .join(" ")
            .trim() ||
            fallbackEmail.split("@")[0] ||
            fallbackEmail);
    return { name: derivedName, lastName: lastName ?? undefined };
};
export const loginUserService = async ({ email, password, }) => {
    if (!email || !password)
        throw createError(400, "Email and password are required");
    const normalizedEmail = email.trim().toLowerCase();
    const supabaseClient = createSupabaseClient();
    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: normalizedEmail,
        password,
    });
    if (error || !data?.user || !data.session) {
        const statusCode = typeof error?.status === "number" ? error.status : 401;
        throw createError(statusCode, error?.message ?? "Invalid credentials");
    }
    const { user: supabaseUser, session } = data;
    const userMetadata = isRecord(supabaseUser.user_metadata) ? supabaseUser.user_metadata : {};
    const appMetadata = isRecord(supabaseUser.app_metadata) ? supabaseUser.app_metadata : {};
    const { name, lastName } = buildUserName(userMetadata, supabaseUser.email ?? normalizedEmail);
    const language = resolveLanguage(userMetadata.language);
    const role = resolveRole(ensureString(appMetadata.role), ensureString(userMetadata.role));
    const baseUserData = {
        email: normalizedEmail,
        name,
        role,
        accessToken: session.access_token,
        refreshToken: session.refresh_token ?? undefined,
    };
    if (lastName)
        baseUserData.lastName = lastName;
    const phone = ensureString(userMetadata.phone);
    if (phone)
        baseUserData.phone = phone;
    const location = ensureString(userMetadata.location);
    if (location)
        baseUserData.location = location;
    if (language)
        baseUserData.language = language;
    const avatar = ensureString(userMetadata.image);
    if (avatar)
        baseUserData.image = avatar;
    if (supabaseUser.email_confirmed_at) {
        baseUserData.emailVerified = new Date(supabaseUser.email_confirmed_at);
    }
    const user = await prisma.$transaction(async (tx) => {
        let currentUser;
        const existingUser = await tx.user.findUnique({ where: { id: supabaseUser.id } });
        if (existingUser) {
            currentUser = await tx.user.update({
                where: { id: existingUser.id },
                data: {
                    ...baseUserData,
                },
            });
        }
        else {
            currentUser = await tx.user.create({
                data: {
                    id: supabaseUser.id,
                    ...baseUserData,
                },
            });
        }
        if (role === UserRole.CLIENT) {
            const client = await tx.client.upsert({
                where: { userId: currentUser.id },
                update: {},
                create: {
                    user: {
                        connect: { id: currentUser.id },
                    },
                },
                select: { id: true },
            });
            if (currentUser.clientId !== client.id) {
                currentUser = await tx.user.update({
                    where: { id: currentUser.id },
                    data: { clientId: client.id },
                });
            }
        }
        return currentUser;
    });
    return {
        user,
        tokens: {
            accessToken: session.access_token,
            refreshToken: session.refresh_token ?? undefined,
            expiresIn: session.expires_in,
            expiresAt: session.expires_at,
            tokenType: session.token_type,
        },
    };
};
