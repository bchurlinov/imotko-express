import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
import Cors from "@/lib/cors";
import sharp from "sharp";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

sharp.cache(false);
sharp.concurrency(1);

const generateUniqueFileName = () => {
const uid = uuidv4();
const timestamp = Math.floor(Date.now() / 1000);
return `${uid}_${timestamp}`;
};

const getFileInfo = (fileName, mimeType) => {
const extension = fileName.toLowerCase().split(".").pop();

    if (extension === "png" || mimeType === "image/png") {
        return { format: "png", extension: "png", contentType: "image/png" };
    } else if (["jpg", "jpeg"].includes(extension) || mimeType === "image/jpeg") {
        return { format: "jpeg", extension: "jpg", contentType: "image/jpeg" };
    } else if (extension === "webp" || mimeType === "image/webp") {
        return { format: "webp", extension: "webp", contentType: "image/webp" };
    }

    return { format: "jpeg", extension: "jpg", contentType: "image/jpeg" };
};

export async function POST(request) {
try {
const corsResponse = Cors(request);
if (corsResponse.status !== 200) return corsResponse;

        const formData = await request.formData();
        const files = formData.getAll("file");

        let response = [];

        for (const file of files) {
            const fileName = generateUniqueFileName();
            const fileInfo = getFileInfo(file.name, file.type);

            const binaryFile = await file.arrayBuffer();
            const fileBuffer = Buffer.from(binaryFile);

            const sizes = [
                { key: "small", width: 300, quality: 60, suffix: "small" },
                { key: "medium", width: 650, quality: 60, suffix: "medium" },
                { key: "large", width: 900, quality: 60, suffix: "large" },
            ];

            let sizesResult = [];
            let sizesObject = {};

            for (const { key, width, suffix, quality } of sizes) {
                try {
                    let sharpInstance = sharp(fileBuffer).resize({ width });
                    let resizedImageBuffer;

                    if (fileInfo.format === "png") {
                        resizedImageBuffer = await sharpInstance
                            .png({
                                quality: quality,
                                compressionLevel: 6,
                                adaptiveFiltering: false,
                            })
                            .toBuffer();
                    } else if (fileInfo.format === "webp") {
                        resizedImageBuffer = await sharpInstance.webp({ quality }).toBuffer();
                    } else {
                        resizedImageBuffer = await sharpInstance.jpeg({ quality }).toBuffer();
                    }

                    const sanitizedFileName = fileName.replace(/\+/g, "_");
                    const supabaseKey = `${sanitizedFileName}-${suffix}.${fileInfo.extension}`;

                    const { data, error } = await supabase.storage
                        .from("imotko-prod")
                        .upload(supabaseKey, resizedImageBuffer, {
                            contentType: fileInfo.contentType,
                            upsert: false,
                        });

                    if (error) {
                        console.error("Error uploading to Supabase:", error);
                        continue;
                    }

                    const {
                        data: { publicUrl },
                    } = supabase.storage.from("imotko-prod").getPublicUrl(supabaseKey);

                    sizesResult.push({ key, supabaseKey });
                    sizesObject[key] = publicUrl;
                } catch (error) {
                    console.error("Error processing image:", error);
                }
            }

            const supabaseUrls = sizesResult.map((size) => size.supabaseKey);
            const imageId = uuidv4();

            response.push({
                id: imageId,
                name: null,
                sizes: sizesObject,
                s3Urls: supabaseUrls,
            });
        }
        return NextResponse.json({ data: response, code: 201, message: null }, { status: 201, statusText: "OK" });
    } catch (error) {
        console.error(`[POST] /api/upload`, error);
        return NextResponse.json(
            { data: undefined, code: 500, message: "somethingWentWrong" },
            { status: 500, statusText: "Not OK" }
        );
    }
}

#Example import data:
"title": "SE IZNAJMUVA TROSOBEN STAN VO CENTAR,DEBAR MAALO",
"images": [
"https://media.pazar3.mk/Image/be6036be42044e9c93c1b3bb113c55ca/20251223/false/false/1280/960/se-iznajmuva-trosoben-stan-vo-centar-debar-maalo.jpeg?noLogo=true",
"https://media.pazar3.mk/Image/1d2c4d86428b46f387c59592f4e9cb6b/20251223/false/false/1280/960/se-iznajmuva-trosoben-stan-vo-centar-debar-maalo.jpeg?noLogo=true",
"https://media.pazar3.mk/Image/7fe595ff5fab44ff83e8e843c312fd04/20251223/false/false/1280/960/se-iznajmuva-trosoben-stan-vo-centar-debar-maalo.jpeg?noLogo=true",
"https://media.pazar3.mk/Image/ad50a9208863401aa5664b2f2608a863/20251223/false/false/1280/960/se-iznajmuva-trosoben-stan-vo-centar-debar-maalo.jpeg?noLogo=true",
"https://media.pazar3.mk/Image/c4848b63a18b4af08947a7605ae62fa6/20251223/false/false/1280/960/se-iznajmuva-trosoben-stan-vo-centar-debar-maalo.jpeg?noLogo=true",
"https://media.pazar3.mk/Image/a64ef7003c924811b0a2a3646e508f98/20251223/false/false/1280/960/se-iznajmuva-trosoben-stan-vo-centar-debar-maalo.jpeg?noLogo=true",
"https://media.pazar3.mk/Image/4679eb6fdc474255b3e4151d3d67b58c/20251223/false/false/1280/960/se-iznajmuva-trosoben-stan-vo-centar-debar-maalo.jpeg?noLogo=true",
"https://media.pazar3.mk/Image/b2b2f9781a3a4fee85daad5edce67bd0/20251223/false/false/1280/960/se-iznajmuva-trosoben-stan-vo-centar-debar-maalo.jpeg?noLogo=true",
"https://media.pazar3.mk/Image/70e369d22e9a4f5ca30148c4674f6a92/20251223/false/false/1280/960/se-iznajmuva-trosoben-stan-vo-centar-debar-maalo.jpeg?noLogo=true",
"https://media.pazar3.mk/Image/28c0389f46cc4bf2b798666d12ed2fc6/20251223/false/false/1280/960/se-iznajmuva-trosoben-stan-vo-centar-debar-maalo.jpeg?noLogo=true",
"https://media.pazar3.mk/Image/c69e7faa38e64d7291c0889b0e84b31d/20251223/false/false/1280/960/se-iznajmuva-trosoben-stan-vo-centar-debar-maalo.jpeg?noLogo=true",
"https://media.pazar3.mk/Image/5f26cb19c41442c8b3e9e38042578d6b/20251223/false/false/1280/960/se-iznajmuva-trosoben-stan-vo-centar-debar-maalo.jpeg?noLogo=true"
],
"description": "ШИФРА- 3518„ДЕЛТА“ Агенција за недвижности изнајмува наместен трособен стан во Центар, кај Fitnes House. Станот е комплетно наместен со нов мебел и бела техника.- 62м2- 2 спални- бања- дневна+кујна+трпезарија- тераса- 5/6 спрат- лифт- централно греење- паркинг место на ПОЦцена: 550еур. + режиски трошоци☎ 071 343 221071 343 224075 445 667✉ deltanedviznosti1@gmail.com",
"date": "дек. 23 2025",
"price": "550 ЕУР / месечно",
"numOfRooms": 3,
"condition": "Ново",
"address": "Центар, Дебар Маало",
"area": "62 m2",
"listingType": "Се изнајмува",
"listedBy": "Продавница",
"location": "Центар, Скопjе"
},
{
"title": "TROSOBEN STAN NAD MVR, CENTAR-VODNO",
"images": [
"https://media.pazar3.mk/Image/158e37fb-07d1-47e3-b639-dd6a59a665c7/20251223/false/false/1280/960/trosoben-stan-nad-mvr-centar-vodno.jpeg?noLogo=true",
"https://media.pazar3.mk/Image/417b60e1-c5c7-461c-9c5c-ffbab1ee1bda/20251223/false/false/1280/960/trosoben-stan-nad-mvr-centar-vodno.jpeg?noLogo=true",
"https://media.pazar3.mk/Image/08f1ad1d-a153-4bf4-b673-1382c220163e/20251223/false/false/1280/960/trosoben-stan-nad-mvr-centar-vodno.jpeg?noLogo=true",
"https://media.pazar3.mk/Image/f7166890-6cd4-40dc-8b73-bce768d0aaaa/20251223/false/false/1280/960/trosoben-stan-nad-mvr-centar-vodno.jpeg?noLogo=true",
"https://media.pazar3.mk/Image/cccc48aa-4759-4483-8015-4561458fbd05/20251223/false/false/1280/960/trosoben-stan-nad-mvr-centar-vodno.jpeg?noLogo=true",
"https://media.pazar3.mk/Image/75cbffbd-b046-4bad-bc6b-8fc28f6a14b0/20251223/false/false/1280/960/trosoben-stan-nad-mvr-centar-vodno.jpeg?noLogo=true",
"https://media.pazar3.mk/Image/eb8a7463-e760-4f98-bee8-9460e154f093/20251223/false/false/1280/960/trosoben-stan-nad-mvr-centar-vodno.jpeg?noLogo=true",
"https://media.pazar3.mk/Image/8c058449-d045-47a7-bdaa-ccd257c18542/20251223/false/false/1280/960/trosoben-stan-nad-mvr-centar-vodno.jpeg?noLogo=true",
"https://media.pazar3.mk/Image/92072dd8-1063-4dfd-959f-81fee2111923/20251223/false/false/1280/960/trosoben-stan-nad-mvr-centar-vodno.jpeg?noLogo=true",
"https://media.pazar3.mk/Image/25c0b66b-7d0a-43a3-bdea-f6711614e8c0/20251223/false/false/1280/960/trosoben-stan-nad-mvr-centar-vodno.jpeg?noLogo=true"
],
"description": "ШИФРА- 4821„ДЕЛТА“ Агенција за недвижности, изнајмува трособен стан во Центар, Водно над МВР.- 64м2- дневна + кујна- 2 спални- тераса- бања- 2/2 кат- паркинг- греење на инвертер или сопствено парно на струјацена: 450еур + режиски трошоци☎ 075 445 667/071 343 221✉ deltanedviznosti1@gmail.com",
"date": "дек. 23 2025",
"price": "450 ЕУР / месечно",
"numOfRooms": 3,
"condition": "Ново",
"address": "Водно",
"area": "64 m2",
"listingType": "Се изнајмува",
"listedBy": "Продавница",
"location": "Центар, Скопjе"
},
{
"title": "SE IZNAJMUVA TROSOBEN STAN VO AERODROM, MICHURIN",
"images": [
"https://media.pazar3.mk/Image/515ed21c-75b7-4fa3-ade1-7c3b54785e9c/20251223/false/false/1280/960/se-iznajmuva-trosoben-stan-vo-aerodrom-michurin.jpeg?noLogo=true",
"https://media.pazar3.mk/Image/cb2362a6-5694-4095-9550-5c09e67fb202/20251223/false/false/1280/960/se-iznajmuva-trosoben-stan-vo-aerodrom-michurin.jpeg?noLogo=true",
"https://media.pazar3.mk/Image/eed828ff-f685-477b-ad1b-e45bcb03776c/20251223/false/false/1280/960/se-iznajmuva-trosoben-stan-vo-aerodrom-michurin.jpeg?noLogo=true",
"https://media.pazar3.mk/Image/072e8201-cf6a-41a1-b2e6-a3a1744d30eb/20251223/false/false/1280/960/se-iznajmuva-trosoben-stan-vo-aerodrom-michurin.jpeg?noLogo=true",
"https://media.pazar3.mk/Image/8a9293b6-d071-4b2c-ac70-613e0dc5044f/20251223/false/false/1280/960/se-iznajmuva-trosoben-stan-vo-aerodrom-michurin.jpeg?noLogo=true",
"https://media.pazar3.mk/Image/e46d3b1d-44d9-414f-b2cb-1ae1695782be/20251223/false/false/1280/960/se-iznajmuva-trosoben-stan-vo-aerodrom-michurin.jpeg?noLogo=true"
],
"description": "ШИФРА- 4819„ДЕЛТА“ Агенција за недвижности, изнајмува нов убаво наместен трособен стан вo Аеродром, Мичурин. Станот е комплетно наместен со нов мебел и бела техника. Поседува сопствено паркинг место.- 85м2- 2 спални- бања + тоалет- дневна со кујна и трпезарија- тераса- 3ти кат- греење/ладење на инвертер + сопствено парно- сопствено паркинг местоцена: 650еур. додатно режиски трошоци☎ 071 343 221075 445 667✉ deltanedviznosti1@gmail.com",
"date": "дек. 23 2025",
"price": "650 ЕУР / месечно",
"numOfRooms": 3,
"condition": "Ново",
"address": "Аеродром, Мичурин",
"area": "85 m2",
"features": [
"Балкон / Тераса",
"Шпорет / Камин",
"Лифт",
"Паркинг простор / Гаража",
"Нова градба",
"Наместен",
"Интерфон"
],
"listingType": "Се изнајмува",
"listedBy": "Продавница",
"location": "Аеродром, Скопjе"
},
{
"title": "SE PRODAVA NOV, NEVSELUVAN STAN VO CENTAR, PROLET",
"images": [
"https://media.pazar3.mk/Image/7aa77bb3-c0e3-4727-b8d0-6d889fc5b40c/20251223/false/false/1280/960/se-prodava-nov-nevseluvan-stan-vo-centar-prolet.jpeg?noLogo=true",
"https://media.pazar3.mk/Image/e4306948-c57b-47df-82f8-d435834ef9c2/20251223/false/false/1280/960/se-prodava-nov-nevseluvan-stan-vo-centar-prolet.jpeg?noLogo=true",
"https://media.pazar3.mk/Image/056508c9-84b8-4101-9afc-5dd17ace7e3c/20251223/false/false/1280/960/se-prodava-nov-nevseluvan-stan-vo-centar-prolet.jpeg?noLogo=true",
"https://media.pazar3.mk/Image/375ecc1d-9470-4f0a-8cf1-f2bfeba1f606/20251223/false/false/1280/960/se-prodava-nov-nevseluvan-stan-vo-centar-prolet.jpeg?noLogo=true",
"https://media.pazar3.mk/Image/c7ca1799-b9fd-4e95-ae32-2b2be326f398/20251223/false/false/1280/960/se-prodava-nov-nevseluvan-stan-vo-centar-prolet.jpeg?noLogo=true",
"https://media.pazar3.mk/Image/b073b6d9-19d1-46ca-a9af-20f4955a9bd4/20251223/false/false/1280/960/se-prodava-nov-nevseluvan-stan-vo-centar-prolet.jpeg?noLogo=true",
"https://media.pazar3.mk/Image/16f0d46d-f071-416f-a011-89d3a6ff7320/20251223/false/false/1280/960/se-prodava-nov-nevseluvan-stan-vo-centar-prolet.jpeg?noLogo=true",
"https://media.pazar3.mk/Image/c4d0055c-03e8-43b8-bbb4-2e02dbee79ff/20251223/false/false/1280/960/se-prodava-nov-nevseluvan-stan-vo-centar-prolet.jpeg?noLogo=true",
"https://media.pazar3.mk/Image/69b0e121-496c-4960-941b-9c8b02d5e12d/20251223/false/false/1280/960/se-prodava-nov-nevseluvan-stan-vo-centar-prolet.jpeg?noLogo=true",
"https://media.pazar3.mk/Image/c61dd523-9d5e-4d56-8ca5-bc3c9ce52c08/20251223/false/false/1280/960/se-prodava-nov-nevseluvan-stan-vo-centar-prolet.jpeg?noLogo=true",
"https://media.pazar3.mk/Image/1df20dc9-d700-4a43-b9d4-a44ec07fbd13/20251223/false/false/1280/960/se-prodava-nov-nevseluvan-stan-vo-centar-prolet.jpeg?noLogo=true",
"https://media.pazar3.mk/Image/da6c75a5-15d7-4581-a8d0-5122d52cc046/20251223/false/false/1280/960/se-prodava-nov-nevseluvan-stan-vo-centar-prolet.jpeg?noLogo=true"
],
"description": "ШИФРА- 4820„ДЕЛТА“ Агенција за недвижности продава трособен стан во Центар, Пролет. Станот е нов и досега не е вселуван.- 74м2- дневна со кујна- 2 спални соби- бања и гостински тоалет- тераса- греење централно- 3/5 кат со лифт- ориентација југоисток- паркинг место на -1 со доплата 15000еурцена: 2350еур/м2☎ 075 424 130070 342 286✉ deltanedviznosti1@gmail.com",
"date": "дек. 23 2025",
"price": "2350 ЕУР",
"numOfRooms": 3,
"condition": "Ново",
"address": "Центар, Пролет",
"area": "74 m2",
"listingType": "Се продава",
"listedBy": "Продавница",
"location": "Центар, Скопjе"
},
{
"title": "PRAZEN TROSOBEN STAN ZA DELOVNA NAMENA VO CENTAR,DEBAR MAALО",
"images": [
"https://media.pazar3.mk/Image/077cca11-709e-4f3f-9e9e-3d046e1fcf20/20251223/false/false/1280/960/prazen-trosoben-stan-za-delovna-namena-vo-centar-debar-maalo.jpeg?noLogo=true",
"https://media.pazar3.mk/Image/f00dac11-f5ca-4582-8d94-7fffc46c4fe0/20251223/false/false/1280/960/prazen-trosoben-stan-za-delovna-namena-vo-centar-debar-maalo.jpeg?noLogo=true",
"https://media.pazar3.mk/Image/abc3a798-aacb-4490-8593-c0183a3102e8/20251223/false/false/1280/960/prazen-trosoben-stan-za-delovna-namena-vo-centar-debar-maalo.jpeg?noLogo=true",
"https://media.pazar3.mk/Image/a90f9593-94bd-409f-87ed-d5bc217e41b0/20251223/false/false/1280/960/prazen-trosoben-stan-za-delovna-namena-vo-centar-debar-maalo.jpeg?noLogo=true",
"https://media.pazar3.mk/Image/7e1e2380-c542-4533-ba39-275daf626284/20251223/false/false/1280/960/prazen-trosoben-stan-za-delovna-namena-vo-centar-debar-maalo.jpeg?noLogo=true",
"https://media.pazar3.mk/Image/44538c40-d517-46a1-bb45-1001f2d8224b/20251223/false/false/1280/960/prazen-trosoben-stan-za-delovna-namena-vo-centar-debar-maalo.jpeg?noLogo=true",
"https://media.pazar3.mk/Image/bd994c76-37b4-44d4-bbde-131e62d1c1cc/20251223/false/false/1280/960/prazen-trosoben-stan-za-delovna-namena-vo-centar-debar-maalo.jpeg?noLogo=true"
],
"description": "ШИФРА- 4818„ДЕЛТА“ Агенција за недвижности изнајмува празен стан во Центар, Дебар Маало во близина на Соборен Храм. Станот се состои од три простории и е погоден за канцеларија.- 90м2- три простории- бања + тоалет- кујна- балкон- 2ри кат- централно греењецена: 650еур. додатно режиски трошоци☎ 071 343 221075 445 667✉ deltanedviznosti1@gmail.com",
"date": "дек. 23 2025",
"price": "650 ЕУР / месечно",
"numOfRooms": 3,
"condition": "Ново",
"address": "Центар, Дебар Маало",
"area": "90 m2",
"features": [
"Балкон / Тераса",
"Шпорет / Камин",
"Лифт",
"Паркинг простор / Гаража",
"Нова градба",
"Интерфон"
],
"listingType": "Се изнајмува",
"listedBy": "Продавница",
"location": "Центар, Скопjе"
},