import { NextResponse } from "next/server";
import { auth } from "auth";
import { getClientByUserId } from "@/data/client";
import { Limiter } from "@/lib/limiter";
import { EngagementType } from "@/generated/prisma";
import { geolocation } from "@vercel/functions";
import { revalidatePath } from "next/cache";
import { ROUTE_URL } from "@/constants/route_url";
import prisma from "@/lib/prismadb";
import Cors from "@/lib/cors";

export async function POST(req) {
try {
const corsResponse = Cors(req);
if (corsResponse.status !== 200) return corsResponse;

        const limitReached = await Limiter();
        if (limitReached)
            return NextResponse.json(
                {
                    data: undefined,
                    code: 429,
                    message: "tooManyAttempts",
                },
                { status: 429, statusText: "Not OK" }
            );

        const session = await auth();
        if (!session?.user) {
            return NextResponse.json(
                { data: undefined, code: 401, message: "unauthorized" },
                { status: 401, statusText: "Not OK" }
            );
        }

        const body = await req.json();
        const existingClient = await getClientByUserId(body.userId);
        if (!existingClient)
            return NextResponse.json(
                { data: undefined, code: 400, message: "noClientExistWithId" },
                { status: 400, statusText: "Not OK" }
            );

        const geoLocationData = geolocation(req);
        const [newFavorite] = await prisma.$transaction([
            prisma.propertyFavorite.create({
                data: {
                    favoriteDate: new Date(),
                    property: { connect: { id: body.propertyId } },
                    client: { connect: { id: existingClient.id } },
                },
            }),
            prisma.propertyEngagement.create({
                data: {
                    propertyId: body.propertyId,
                    clientId: existingClient.id,
                    type: EngagementType.FAVORITE,
                    additionalInfo: geoLocationData,
                },
            }),
        ]);

        revalidatePath(ROUTE_URL.ACCOUNT_SAVED_PROPERTIES);

        return NextResponse.json(
            {
                data: newFavorite,
                code: 201,
                message: "propertyAddFavoritesSuccess",
            },
            { status: 201, statusText: "OK" }
        );
    } catch (err) {
        console.error(`[POST] /api/properties/favorite`, err);
        return NextResponse.json(
            { data: undefined, code: 500, message: "somethingWentWrong" },
            { status: 500, statusText: "Not OK" }
        );
    }

}

import { NextResponse } from "next/server";
import { auth } from "auth";
import { Limiter } from "@/lib/limiter";
import { revalidatePath } from "next/cache";
import { ROUTE_URL } from "@/constants/route_url";
import prisma from "@/lib/prismadb";
import Cors from "@/lib/cors";

export async function DELETE(req, props) {
const params = await props.params;
try {
const corsResponse = Cors(req);
if (corsResponse.status !== 200) return corsResponse;

        const limitReached = await Limiter();
        if (limitReached)
            return NextResponse.json(
                {
                    data: undefined,
                    code: 429,
                    message: "tooManyAttempts",
                },
                { status: 429, statusText: "Not OK" }
            );

        const session = await auth();
        if (!session?.user) {
            return NextResponse.json(
                { data: undefined, code: 401, message: "unauthorized" },
                { status: 401, statusText: "Not OK" }
            );
        }

        const deletedFavorite = await prisma.propertyFavorite.delete({
            where: {
                id: params.id,
            },
        });

        revalidatePath(ROUTE_URL.ACCOUNT_SAVED_PROPERTIES);

        return NextResponse.json(
            {
                data: deletedFavorite,
                code: 20,
                message: "propertyRemoveFavoriteSuccess",
            },
            { status: 200, statusText: "OK" }
        );
    } catch (err) {
        console.error(`[DELETE] /api/properties/favorite`, err);
        return NextResponse.json(
            { data: undefined, code: 500, message: "somethingWentWrong" },
            { status: 500, statusText: "Not OK" }
        );
    }

}
