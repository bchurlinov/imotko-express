"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var prisma_1 = require("@generated/prisma");
var prisma = new prisma_1.PrismaClient({
    omit: {
        user: {
            refreshToken: true,
            accessToken: true,
            ipAddress: true,
        },
    },
});
exports.default = prisma;
