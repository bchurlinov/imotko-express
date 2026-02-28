# Example body
params >> {
email: 'contact@bojanchurlinov.com',
filters: [
{ label: 'location', value: 'arachinovo' },
{ label: 'subCategory', value: '102' },
{ label: 'category', value: '1' },
{ label: 'listingType', value: 'for_sale' },
{ label: 'size_from', value: '15' },
{ label: 'size_to', value: '50' },
{ label: 'price_from', value: '315000' },
{ label: 'price_to', value: '720000' },
{ label: 'numOfBedroomsFrom', value: '3' },
{ label: 'numOfBathroomsFrom', value: '2' }
],
queryString: '?location=arachinovo&subCategory=102&category=1&listingType=for_sale&size_from=15&size_to=50&price_from=315000&price_to=720000&numOfBedroomsFrom=3&numOfBathroomsFrom=2',
params: {
location: 'arachinovo',
subCategory: '102',
category: '1',
listingType: 'for_sale',
size_from: 15,
size_to: 50,
price_from: 315000,
price_to: 720000,
numOfBedroomsFrom: 3,
numOfBathroomsFrom: 2
},
locale: 'mk',
preferences: { matchAlerts: true, agencyOffers: true }
}

# Example route code from the other application

import { NextResponse } from "next/server";
import { i18n } from "@/i18n";
import { auth } from "auth";
import { translation } from "@/utils/translations";
import { getUserByEmail } from "@/data/user/user";
import { ROUTE_URL } from "@/constants/route_url";
import { PropertyLocationDictionary, PropertyTypeDictionary } from "@/lib/dictionaries/property";
import { Limiter } from "@/lib/limiter";
import { revalidatePath } from "next/cache";
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
        const { email, filters, queryString, params } = body;

        const existingUser = await getUserByEmail(email);
        if (!existingUser)
            return NextResponse.json(
                { data: undefined, code: 400, message: "userEmailNotExist" },
                { status: 400, statusText: "Not OK" }
            );

        const locales = i18n.locales;
        const getLocalizedValue = (dictionary, locale, key) => {
            return (
                dictionary[locale].find((d) => d.value === key)?.label ||
                dictionary[locale].find((d) => d.value === key)?.pluralLabel
            );
        };

        const titles = locales.reduce((acc, locale) => {
            const category = getLocalizedValue(PropertyTypeDictionary, locale, params?.type);
            const location = getLocalizedValue(PropertyLocationDictionary, locale, params?.location);

            let title;
            if (params?.location && params?.type)
                title = translation("Misc.categoryInLocation", { category, location })(locale);
            else if (params?.location) title = translation("Misc.propertiesInLocation", { location })(locale);
            else title = translation("Common.properties", {})(locale);

            acc[locale] = typeof title === "function" ? title() : title;
            return acc;
        }, {});

        const prepareFilters = filters?.reduce((acc, filter) => {
            acc[filter.label] = filter.value;
            return acc;
        }, {});

        const createdSearch = await prisma.$transaction(async (tx) => {
            return tx.clientSearch.create({
                data: {
                    client: { connect: { id: existingUser.client.id } },
                    link: `${ROUTE_URL.SEARCH_PROPERTIES}${queryString}`,
                    title: titles,
                    filters: prepareFilters,
                },
            });
        });

        revalidatePath("/(client-account)/korisnicka-smetka/zacuvani-prebaruvanja", "page");

        return NextResponse.json(
            {
                data: createdSearch,
                code: 201,
                message: "propertySaveSearchSuccess",
            },
            { status: 201, statusText: "OK" }
        );
    } catch (err) {
        console.error(`[POST] /api/clients/search`, err);
        return NextResponse.json(
            { data: undefined, code: 500, message: "somethingWentWrong" },
            { status: 500, statusText: "Not OK" }
        );
    }
}

# Imports for the missing dictionaries

Those dictionaries can be found "./src/lib/dictionaries/property/index.js". You have property_category.dictionary etc.

# Outcome of the translated content
{"en": "Properties in Skopje - Centar", "mk": "Недвижности во Скопје - Центар", "sq": "Prona në Skopje - Centar"}
{"en": "Properties in Skopje - Karposh", "mk": "Недвижности во Скопје - Карпош", "sq": "Prona në Skopje - Karposh"}
{"en": "Properties in Ohrid", "mk": "Недвижнини во Охрид", "sq": "Prona në Ohrid"}
{"en": "Properties in Bitola", "mk": "Недвижности во Битола", "sq": "Prona në Bitola"}
{"en": "Properties in Skopje - Centar", "mk": "Недвижности во Скопје - Центар", "sq": "Prona në Skopje - Centar"}