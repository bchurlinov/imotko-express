// COPIED FROM imotko/src/lib/dictionaries/property.js by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).
import { ROUTE_URL } from "../route_url.js"
import {
    PropertyCountry,
    PropertyListingType,
    PropertyOrientation,
    PropertyStatus,
    PropertyType,
} from "#generated/prisma/enums.ts"
import {
    AlbaniaMunicipalityEntries,
    BulgariaMunicipalityEntries,
    GreeceMunicipalityEntries,
    SerbiaMunicipalityEntries,
} from "./property_municipalities.js"

export const PropertyStatusDictionary = {
    [PropertyStatus.PUBLISHED]: "published",
    [PropertyStatus.UNPUBLISHED]: "unpublished",
    [PropertyStatus.DELETED]: "deleted",
    [PropertyStatus.DECLINED]: "declined",
    [PropertyStatus.DRAFT]: "draft",
    [PropertyStatus.PENDING]: "pending",
}

export const PropertyPriceDictionary = {
    [PropertyType.flat]: {
        [PropertyListingType.for_sale]: {
            from: [
                "10000",
                "20000",
                "30000",
                "50000",
                "60000",
                "75000",
                "100000",
                "125000",
                "150000",
                "200000",
                "300000",
            ],
            to: [
                "20000",
                "30000",
                "50000",
                "60000",
                "75000",
                "100000",
                "125000",
                "150000",
                "200000",
                "300000",
                "300000+",
            ],
        },
        [PropertyListingType.for_rent]: {
            from: ["100", "200", "300", "400", "500", "600", "800", "1000", "1500"],
            to: ["200", "300", "400", "500", "600", "800", "1000", "1500", "1500+"],
        },
    },
    [PropertyType.house]: {
        [PropertyListingType.for_sale]: {
            from: ["50000", "75000", "100000", "150000", "200000", "300000", "400000", "500000", "750000"],
            to: ["75000", "100000", "150000", "200000", "300000", "400000", "500000", "750000", "750000+"],
        },
        [PropertyListingType.for_rent]: {
            from: ["300", "500", "750", "1000", "1500", "2000", "2500", "3000", "4000"],
            to: ["500", "750", "1000", "1500", "2000", "2500", "3000", "4000", "4000+"],
        },
    },
    [PropertyType.land]: {
        [PropertyListingType.for_sale]: {
            from: ["10000", "25000", "50000", "75000", "100000", "150000", "200000", "300000", "500000"],
            to: ["25000", "50000", "75000", "100000", "150000", "200000", "300000", "500000", "500000+"],
        },
        [PropertyListingType.for_rent]: {
            from: ["100", "200", "300", "500", "750", "1000", "1500", "2000", "3000"],
            to: ["200", "300", "500", "750", "1000", "1500", "2000", "3000", "3000+"],
        },
    },
    [PropertyType.garage]: {
        [PropertyListingType.for_sale]: {
            from: ["5000", "10000", "15000", "20000", "25000", "30000", "40000", "50000", "75000"],
            to: ["10000", "15000", "20000", "25000", "30000", "40000", "50000", "75000", "75000+"],
        },
        [PropertyListingType.for_rent]: {
            from: ["50", "75", "100", "150", "200", "250", "300", "400", "500"],
            to: ["75", "100", "150", "200", "250", "300", "400", "500", "500+"],
        },
    },
    [PropertyType.holiday_home]: {
        [PropertyListingType.for_sale]: {
            from: ["10000", "25000", "50000", "100000", "150000", "200000", "300000", "400000", "500000"],
            to: ["25000", "50000", "100000", "150000", "200000", "300000", "400000", "500000", "500000+"],
        },
        [PropertyListingType.for_rent]: {
            from: ["200", "300", "500", "750", "1000", "1500", "2000", "2500", "3000"],
            to: ["300", "500", "750", "1000", "1500", "2000", "2500", "3000", "3000+"],
        },
    },
    [PropertyType.commercial]: {
        [PropertyListingType.for_sale]: {
            from: ["50000", "100000", "150000", "200000", "300000", "500000", "750000", "1000000", "2000000"],
            to: ["100000", "150000", "200000", "300000", "500000", "750000", "1000000", "2000000", "2000000+"],
        },
        [PropertyListingType.for_rent]: {
            from: ["200", "500", "1000", "1500", "2000", "3000", "5000", "7500", "10000"],
            to: ["500", "1000", "1500", "2000", "3000", "5000", "7500", "10000", "10000+"],
        },
    },
    DEFAULT: {
        [PropertyListingType.for_sale]: {
            from: ["10000", "50000", "100000", "200000", "300000", "500000", "750000", "1000000", "2000000"],
            to: ["50000", "100000", "200000", "300000", "500000", "750000", "1000000", "2000000", "2000000+"],
        },
        [PropertyListingType.for_rent]: {
            from: ["100", "200", "300", "500", "750", "1000", "1500", "2000", "3500"],
            to: ["200", "300", "500", "750", "1000", "1500", "2000", "3500", "3500+"],
        },
    },
}

export const PropertySizeDictionary = {
    [PropertyType.flat]: {
        from: [
            "15",
            "25",
            "30",
            "40",
            "50",
            "60",
            "70",
            "80",
            "90",
            "100",
            "110",
            "120",
            "130",
            "140",
            "150",
            "170",
            "200",
        ],
        to: [
            "15",
            "25",
            "30",
            "40",
            "50",
            "60",
            "70",
            "80",
            "90",
            "100",
            "110",
            "120",
            "130",
            "140",
            "150",
            "170",
            "200",
        ],
    },
    [PropertyType.house]: {
        from: ["50", "100", "150", "200", "250", "300", "400", "500", "750"],
        to: ["100", "150", "200", "250", "300", "400", "500", "750", "+750"],
    },
    [PropertyType.land]: {
        from: ["100", "200", "300", "500", "1000", "2000", "5000", "10000", "20000"],
        to: ["200", "300", "500", "1000", "2000", "5000", "10000", "20000", "+20000"],
    },
    [PropertyType.garage]: {
        from: ["10", "20", "30", "40", "50", "60", "70", "80", "100"],
        to: ["20", "30", "40", "50", "60", "70", "80", "100", "+100"],
    },
    [PropertyType.holiday_home]: {
        from: ["50", "100", "150", "200", "250", "300", "400", "500", "750"],
        to: ["100", "150", "200", "250", "300", "400", "500", "750", "+750"],
    },
    [PropertyType.commercial]: {
        from: ["50", "100", "200", "500", "1000", "2000", "5000", "10000", "20000"],
        to: ["100", "200", "500", "1000", "2000", "5000", "10000", "20000", "+20000"],
    },
    [PropertyListingType.for_sale]: {
        from: ["10000", "50000", "100000", "200000", "300000", "500000", "750000", "1000000", "2000000"],
        to: ["50000", "100000", "200000", "300000", "500000", "750000", "1000000", "2000000", "2000000+"],
    },
    [PropertyListingType.for_rent]: {
        from: ["30", "50", "100", "200", "300", "500", "750", "1000", "2000"],
        to: ["50", "100", "200", "300", "500", "750", "1000", "2000", "+2000"],
    },
    DEFAULT: {
        from: ["30", "50", "70", "100", "150", "200", "300", "500", "750", "1000", "2000"],
        to: ["50", "70", "100", "150", "200", "300", "500", "750", "1000", "2000", "+2000"],
    },
}

export const PropertyOrientationDictionary = {
    en: [
        { id: 1, value: PropertyOrientation.north, label: "North" },
        { id: 2, value: PropertyOrientation.south, label: "South" },
        { id: 3, value: PropertyOrientation.east, label: "East" },
        { id: 4, value: PropertyOrientation.west, label: "West" },
        { id: 5, value: PropertyOrientation.northeast, label: "Northeast" },
        { id: 6, value: PropertyOrientation.southeast, label: "Southeast" },
        { id: 7, value: PropertyOrientation.northwest, label: "Northwest" },
        { id: 8, value: PropertyOrientation.southwest, label: "Southwest" },
    ],
    mk: [
        { id: 1, value: PropertyOrientation.north, label: "Север" },
        { id: 2, value: PropertyOrientation.south, label: "Југ" },
        { id: 3, value: PropertyOrientation.east, label: "Исток" },
        { id: 4, value: PropertyOrientation.west, label: "Запад" },
        { id: 5, value: PropertyOrientation.northeast, label: "Северо-исток" },
        { id: 6, value: PropertyOrientation.southeast, label: "Југо-исток" },
        { id: 7, value: PropertyOrientation.northwest, label: "Северо-запад" },
        { id: 8, value: PropertyOrientation.southwest, label: "Југо-запад" },
    ],
    sq: [
        { id: 1, value: PropertyOrientation.north, label: "North" },
        { id: 2, value: PropertyOrientation.south, label: "South" },
        { id: 3, value: PropertyOrientation.east, label: "East" },
        { id: 4, value: PropertyOrientation.west, label: "West" },
        { id: 5, value: PropertyOrientation.northeast, label: "Northeast" },
        { id: 6, value: PropertyOrientation.southeast, label: "Southeast" },
        { id: 7, value: PropertyOrientation.northwest, label: "Northwest" },
        { id: 8, value: PropertyOrientation.southwest, label: "Southwest" },
    ],
    tr: [
        { id: 1, value: PropertyOrientation.north, label: "Kuzey" },
        { id: 2, value: PropertyOrientation.south, label: "Güney" },
        { id: 3, value: PropertyOrientation.east, label: "Doğu" },
        { id: 4, value: PropertyOrientation.west, label: "Batı" },
        { id: 5, value: PropertyOrientation.northeast, label: "Kuzeydoğu" },
        { id: 6, value: PropertyOrientation.southeast, label: "Güneydoğu" },
        { id: 7, value: PropertyOrientation.northwest, label: "Kuzeybatı" },
        { id: 8, value: PropertyOrientation.southwest, label: "Güneybatı" },
    ],
}

export const PropertyListingTypeDictionary = {
    en: [
        { id: 1, value: PropertyListingType.for_sale, label: "For sale" },
        { id: 2, value: PropertyListingType.for_rent, label: "Long-term rent" },
        { id: 3, value: PropertyListingType.short_term_rent, label: "Short-term rent" },
    ],
    mk: [
        { id: 1, value: PropertyListingType.for_sale, label: "За продажба" },
        { id: 2, value: PropertyListingType.for_rent, label: "За долгорочно изнајмување" },
        { id: 3, value: PropertyListingType.short_term_rent, label: "За краткорочно изнајмување" },
    ],
    sq: [
        { id: 1, value: PropertyListingType.for_sale, label: "Për shitje" },
        { id: 2, value: PropertyListingType.for_rent, label: "Me qira afatgjatë" },
        { id: 3, value: PropertyListingType.short_term_rent, label: "Me qira afatshkurtër" },
    ],
    tr: [
        { id: 1, value: PropertyListingType.for_sale, label: "Satılık" },
        { id: 2, value: PropertyListingType.for_rent, label: "Uzun dönem kiralık" },
        { id: 3, value: PropertyListingType.short_term_rent, label: "Kısa dönem kiralık" },
    ],
}

const MacedonianPropertyLocationDictionary = {
    en: [
        // { id: 1850, value: "skopje", label: "Skopje", coordinates: [41.9981, 21.4254], grp: "Popular" },
        // { id: 1520, value: "ohrid", label: "Ohrid", coordinates: [41.1231, 20.8016], grp: "Popular" },
        // { id: 1030, value: "bitola", label: "Bitola", coordinates: [41.0297, 21.3292], grp: "Popular" },
        { id: 101, value: "arachinovo", label: "Arachinovo", coordinates: [41.9940273, 21.5252175], grp: "Locations" },
        { id: 102, value: "berovo", label: "Berovo", coordinates: [41.7061, 22.8552], grp: "Locations" },
        { id: 103, value: "bitola", label: "Bitola", coordinates: [41.0297, 21.3292], grp: "Locations" },
        { id: 104, value: "bogdanci", label: "Bogdanci", coordinates: [41.2031, 22.5754], grp: "Locations" },
        { id: 105, value: "bogovinje", label: "Bogovinje", coordinates: [41.9236, 20.9164], grp: "Locations" },
        { id: 106, value: "bosilovo", label: "Bosilovo", coordinates: [41.439, 22.7316], grp: "Locations" },
        { id: 107, value: "brvenica", label: "Brvenica", coordinates: [41.9681, 20.982], grp: "Locations" },
        { id: 108, value: "valandovo", label: "Valandovo", coordinates: [41.317, 22.5618], grp: "Locations" },
        { id: 109, value: "vasilevo", label: "Vasilevo", coordinates: [41.4742, 22.6422], grp: "Locations" },
        { id: 110, value: "vevcani", label: "Vevcani", coordinates: [41.2408, 20.5916], grp: "Locations" },
        { id: 111, value: "veles", label: "Veles", coordinates: [41.7165, 21.7723], grp: "Locations" },
        { id: 112, value: "vinica", label: "Vinica", coordinates: [41.8833, 22.5081], grp: "Locations" },
        { id: 113, value: "vranestica", label: "Vranestica", coordinates: [41.4453, 21.0259], grp: "Locations" },
        { id: 114, value: "vrapciste", label: "Vrapciste", coordinates: [41.8384, 20.8858], grp: "Locations" },
        { id: 115, value: "gevgelija", label: "Gevgelija", coordinates: [41.1452, 22.4997], grp: "Locations" },
        { id: 116, value: "gostivar", label: "Gostivar", coordinates: [41.8026, 20.9089], grp: "Locations" },
        { id: 117, value: "gradsko", label: "Gradsko", coordinates: [41.5751, 21.9495], grp: "Locations" },
        { id: 118, value: "debar", label: "Debar", coordinates: [41.5198, 20.5289], grp: "Locations" },
        { id: 119, value: "debarca", label: "Debarca", coordinates: [41.3584, 20.8553], grp: "Locations" },
        { id: 120, value: "delcevo", label: "Delcevo", coordinates: [41.9709, 22.774], grp: "Locations" },
        { id: 121, value: "demir_kapija", label: "Demir Kapija", coordinates: [41.4088, 22.2436], grp: "Locations" },
        { id: 122, value: "demir_hisar", label: "Demir Hisar", coordinates: [41.2214, 21.2025], grp: "Locations" },
        { id: 123, value: "dojran", label: "Dojran", coordinates: [41.1811, 22.7227], grp: "Locations" },
        { id: 124, value: "dolneni", label: "Dolneni", coordinates: [41.427, 21.4529], grp: "Locations" },
        { id: 125, value: "drugovo", label: "Drugovo", coordinates: [41.4408, 20.9268], grp: "Locations" },
        { id: 126, value: "zhelino", label: "Zhelino", coordinates: [41.9803, 21.0609], grp: "Locations" },
        { id: 127, value: "zajas", label: "Zajas", coordinates: [41.5983, 20.9417], grp: "Locations" },
        { id: 128, value: "zelenikovo", label: "Zelenikovo", coordinates: [41.8831, 21.5893], grp: "Locations" },
        { id: 129, value: "zrnovci", label: "Zrnovci", coordinates: [41.8541, 22.4438], grp: "Locations" },
        { id: 130, value: "ilinden", label: "Ilinden", coordinates: [41.9957, 21.5677], grp: "Locations" },
        { id: 131, value: "jegunovce", label: "Jegunovce", coordinates: [42.0741, 21.122], grp: "Locations" },
        { id: 132, value: "kavadarci", label: "Kavadarci", coordinates: [41.4329, 22.0089], grp: "Locations" },
        { id: 133, value: "karbinci", label: "Karbinci", coordinates: [41.818, 22.2325], grp: "Locations" },
        { id: 134, value: "kichevo", label: "Kichevo", coordinates: [41.5129, 20.9525], grp: "Locations" },
        { id: 135, value: "konche", label: "Konche", coordinates: [41.4966, 22.383], grp: "Locations" },
        { id: 136, value: "kochani", label: "Kochani", coordinates: [41.9168, 22.4083], grp: "Locations" },
        { id: 137, value: "kratovo", label: "Kratovo", coordinates: [42.08, 22.1803], grp: "Locations" },
        { id: 138, value: "kriva_palanka", label: "Kriva Palanka", coordinates: [42.2058, 22.3308], grp: "Locations" },
        { id: 139, value: "krivogashtani", label: "Krivogashtani", coordinates: [41.3373, 21.3292], grp: "Locations" },
        { id: 140, value: "krushevo", label: "Krushevo", coordinates: [41.3706, 21.2502], grp: "Locations" },
        { id: 141, value: "kumanovo", label: "Kumanovo", coordinates: [42.1323, 21.7257], grp: "Locations" },
        { id: 142, value: "lipkovo", label: "Lipkovo", coordinates: [42.1561, 21.5871], grp: "Locations" },
        { id: 143, value: "lozovo", label: "Lozovo", coordinates: [41.7818, 21.9001], grp: "Locations" },
        {
            id: 144,
            value: "mavrovo_rostusha",
            label: "Mavrovo and Rostusha",
            coordinates: [41.6545, 20.734],
            grp: "Locations",
        },
        {
            id: 145,
            value: "makedonski_brod",
            label: "Makedonski Brod",
            coordinates: [41.5133, 21.2174],
            grp: "Locations",
        },
        {
            id: 146,
            value: "makedonska_kamenica",
            label: "Makedonska Kamenica",
            coordinates: [42.0214, 22.5871],
            grp: "Locations",
        },
        { id: 147, value: "mogila", label: "Mogila", coordinates: [41.1572, 21.4037], grp: "Locations" },
        { id: 148, value: "negotino", label: "Negotino", coordinates: [41.4829, 22.0923], grp: "Locations" },
        { id: 149, value: "novaci", label: "Novaci", coordinates: [41.0443, 21.4589], grp: "Locations" },
        { id: 150, value: "novo selo", label: "Novo Selo", coordinates: [41.4118, 22.8791], grp: "Locations" },
        { id: 151, value: "oslomej", label: "Oslomej", coordinates: [41.5766, 20.998], grp: "Locations" },
        { id: 152, value: "ohrid", label: "Ohrid", coordinates: [41.1231, 20.8016], grp: "Locations" },
        { id: 153, value: "petrovec", label: "Petrovec", coordinates: [41.9402, 21.6094], grp: "Locations" },
        { id: 154, value: "pehchevo", label: "Pehchevo", coordinates: [41.7621, 22.8865], grp: "Locations" },
        { id: 155, value: "plasnica", label: "Plasnica", coordinates: [41.4718, 21.122], grp: "Locations" },
        { id: 156, value: "prilep", label: "Prilep", coordinates: [41.3441, 21.5528], grp: "Locations" },
        { id: 174, value: "shtip", label: "Shtip", coordinates: [41.7464, 22.1997], grp: "Locations" },
        { id: 158, value: "radovish", label: "Radovish", coordinates: [41.6395, 22.4679], grp: "Locations" },
        { id: 159, value: "rankovce", label: "Rankovce", coordinates: [42.1695, 22.1162], grp: "Locations" },
        { id: 160, value: "resen", label: "Resen", coordinates: [41.0903, 21.0133], grp: "Locations" },
        { id: 161, value: "rosoman", label: "Rosoman", coordinates: [41.5176, 21.9433], grp: "Locations" },
        {
            id: 162,
            value: "staro_nagoricane",
            label: "Staro Nagoricane",
            coordinates: [42.2002, 21.8285],
            grp: "Locations",
        },
        { id: 163, value: "sveti_nikole", label: "Sveti Nikole", coordinates: [41.8656, 21.9373], grp: "Locations" },
        { id: 164, value: "sopishte", label: "Sopishte", coordinates: [41.95, 21.4201], grp: "Locations" },
        { id: 165, value: "struga", label: "Struga", coordinates: [41.1778, 20.6783], grp: "Locations" },
        { id: 166, value: "strumica", label: "Strumica", coordinates: [41.4378, 22.6427], grp: "Locations" },
        { id: 167, value: "studenichani", label: "Studenichani", coordinates: [41.8073, 21.4037], grp: "Locations" },
        { id: 168, value: "tearce", label: "Tearce", coordinates: [42.0778, 21.0535], grp: "Locations" },
        { id: 169, value: "tetovo", label: "Tetovo", coordinates: [42.0069, 20.9715], grp: "Locations" },
        { id: 170, value: "centar_zhupa", label: "Centar Zhupa", coordinates: [41.4785, 20.5603], grp: "Locations" },
        { id: 171, value: "chashka", label: "Chashka", coordinates: [44.7893, 93.6018], grp: "Locations" },
        {
            id: 172,
            value: "cheshinovo_obleshevo",
            label: "Cheshinovo and Obleshevo",
            coordinates: [41.892, 22.3099],
            grp: "Locations",
        },
        {
            id: 173,
            value: "chucher_sandevo",
            label: "Chucher Sandevo",
            coordinates: [42.0975, 21.3877],
            grp: "Locations",
        },
        { id: 157, value: "probishtip", label: "Probishtip", coordinates: [41.9948, 22.1877], grp: "Locations" },
        { id: 185, value: "skopje", label: "Skopje", coordinates: [41.9981, 21.4254], grp: "Locations" },
        {
            id: 175,
            value: "skopje-aerodrom",
            label: "Skopje - Aerodrom",
            coordinates: [41.98873, 21.45541],
            grp: "Locations",
        },
        { id: 176, value: "skopje-butel", label: "Skopje - Butel", coordinates: [42.0297, 21.4425], grp: "Locations" },
        {
            id: 177,
            value: "skopje-gazi_baba",
            label: "Skopje - Gazi Baba",
            coordinates: [41.9961, 21.4812],
            grp: "Locations",
        },
        {
            id: 178,
            value: "skopje-gjorce_petrov",
            label: "Skopje - Gjorce Petrov",
            coordinates: [42.0003, 21.3653],
            grp: "Locations",
        },
        {
            id: 179,
            value: "skopje-karposh",
            label: "Skopje - Karposh",
            coordinates: [42.003, 21.3978],
            grp: "Locations",
        },
        {
            id: 180,
            value: "skopje-kisela_voda",
            label: "Skopje - Kisela Voda",
            coordinates: [41.9747, 21.4455],
            grp: "Locations",
        },
        { id: 181, value: "skopje-saraj", label: "Skopje - Saraj", coordinates: [41.9994, 21.3247], grp: "Locations" },
        {
            id: 182,
            value: "skopje-skopje_centar",
            label: "Skopje - Centar",
            coordinates: [41.9954, 21.4246],
            grp: "Locations",
        },
        { id: 183, value: "skopje-chair", label: "Skopje - Chair", coordinates: [42.0108, 21.4425], grp: "Locations" },
        {
            id: 184,
            value: "skopje-shuto_orizari",
            label: "Skopje - Shuto Orizari",
            coordinates: [42.038, 21.4246],
            grp: "Locations",
        },
    ],
    mk: [
        // { id: 1850, value: "skopje", label: "Скопје", coordinates: [41.9981, 21.4254], grp: "Популарни" },
        // { id: 1520, value: "ohrid", label: "Охрид", coordinates: [41.1231, 20.8016], grp: "Популарни" },
        // { id: 1030, value: "bitola", label: "Битола", coordinates: [41.0297, 21.3292], grp: "Популарни" },
        { id: 101, value: "arachinovo", label: "Арачиново", coordinates: [41.9940273, 21.5252175], grp: "Локации" },
        { id: 102, value: "berovo", label: "Берово", coordinates: [41.7061, 22.8552], grp: "Локации" },
        { id: 103, value: "bitola", label: "Битола", coordinates: [41.0297, 21.3292], grp: "Локации" },
        { id: 104, value: "bogdanci", label: "Богданци", coordinates: [41.2031, 22.5754], grp: "Локации" },
        { id: 105, value: "bogovinje", label: "Боговиње", coordinates: [41.9236, 20.9164], grp: "Локации" },
        { id: 106, value: "bosilovo", label: "Босилово", coordinates: [41.439, 22.7316], grp: "Локации" },
        { id: 107, value: "brvenica", label: "Брвеница", coordinates: [41.9681, 20.982], grp: "Локации" },
        { id: 108, value: "valandovo", label: "Валандово", coordinates: [41.317, 22.5618], grp: "Локации" },
        { id: 109, value: "vasilevo", label: "Василево", coordinates: [41.4742, 22.6422], grp: "Локации" },
        { id: 110, value: "vevcani", label: "Вевчани", coordinates: [41.2408, 20.5916], grp: "Локации" },
        { id: 111, value: "veles", label: "Велес", coordinates: [41.7165, 21.7723], grp: "Локации" },
        { id: 112, value: "vinica", label: "Виница", coordinates: [41.8833, 22.5081], grp: "Локации" },
        { id: 113, value: "vranestica", label: "Вранештица", coordinates: [41.4453, 21.0259], grp: "Локации" },
        { id: 114, value: "vrapciste", label: "Врапчиште", coordinates: [41.8384, 20.8858], grp: "Локации" },
        { id: 115, value: "gevgelija", label: "Гевгелија", coordinates: [41.1452, 22.4997], grp: "Локации" },
        { id: 116, value: "gostivar", label: "Гостивар", coordinates: [41.8026, 20.9089], grp: "Локации" },
        { id: 117, value: "gradsko", label: "Градско", coordinates: [41.5751, 21.9495], grp: "Локации" },
        { id: 118, value: "debar", label: "Дебар", coordinates: [41.5198, 20.5289], grp: "Локации" },
        { id: 119, value: "debartsa", label: "Дебарца", coordinates: [41.3584, 20.8553], grp: "Локации" },
        { id: 120, value: "delcevo", label: "Делчево", coordinates: [41.9709, 22.774], grp: "Локации" },
        { id: 121, value: "demir_kapija", label: "Демир Капија", coordinates: [41.4088, 22.2436], grp: "Локации" },
        { id: 122, value: "demir_hisar", label: "Демир Хисар", coordinates: [41.2214, 21.2025], grp: "Локации" },
        { id: 123, value: "dojran", label: "Дојран", coordinates: [41.1811, 22.7227], grp: "Локации" },
        { id: 124, value: "dolneni", label: "Долнени", coordinates: [41.427, 21.4529], grp: "Локации" },
        { id: 125, value: "drugovo", label: "Другово", coordinates: [41.4408, 20.9268], grp: "Локации" },
        { id: 126, value: "zhelino", label: "Желино", coordinates: [41.9803, 21.0609], grp: "Локации" },
        { id: 127, value: "zajas", label: "Зајас", coordinates: [41.5983, 20.9417], grp: "Локации" },
        { id: 128, value: "zelenikovo", label: "Зелениково", coordinates: [41.8831, 21.5893], grp: "Локации" },
        { id: 129, value: "zrnovci", label: "Зрновци", coordinates: [41.8541, 22.4438], grp: "Локации" },
        { id: 130, value: "ilinden", label: "Илинден", coordinates: [41.9957, 21.5677], grp: "Локации" },
        { id: 131, value: "jegunovce", label: "Јегуновце", coordinates: [42.0741, 21.122], grp: "Локации" },
        { id: 132, value: "kavadarci", label: "Кавадарци", coordinates: [41.4329, 22.0089], grp: "Локации" },
        { id: 133, value: "karbinci", label: "Карбинци", coordinates: [41.818, 22.2325], grp: "Локации" },
        { id: 134, value: "kichevo", label: "Кичево", coordinates: [41.5129, 20.9525], grp: "Локации" },
        { id: 135, value: "konche", label: "Конче", coordinates: [41.4966, 22.383], grp: "Локации" },
        { id: 136, value: "kochani", label: "Кочани", coordinates: [41.9168, 22.4083], grp: "Локации" },
        { id: 137, value: "kratovo", label: "Кратово", coordinates: [42.08, 22.1803], grp: "Локации" },
        { id: 138, value: "kriva_palanka", label: "Крива Паланка", coordinates: [42.2058, 22.3308], grp: "Локации" },
        { id: 139, value: "krivogashtani", label: "Кривогаштани", coordinates: [41.3373, 21.3292], grp: "Локации" },
        { id: 140, value: "krushevo", label: "Крушево", coordinates: [41.3706, 21.2502], grp: "Локации" },
        { id: 141, value: "kumanovo", label: "Куманово", coordinates: [42.1323, 21.7257], grp: "Локации" },
        { id: 142, value: "lipkovo", label: "Липково", coordinates: [42.1561, 21.5871], grp: "Локации" },
        { id: 143, value: "lozovo", label: "Лозово", coordinates: [41.7818, 21.9001], grp: "Локации" },
        {
            id: 144,
            value: "mavrovo_rostusha",
            label: "Маврово и Ростуше",
            coordinates: [41.6545, 20.734],
            grp: "Локации",
        },
        {
            id: 145,
            value: "makedonski_brod",
            label: "Македонски Брод",
            coordinates: [41.5133, 21.2174],
            grp: "Локации",
        },
        {
            id: 146,
            value: "makedonska_kamenica",
            label: "Македонска Каменица",
            coordinates: [42.0214, 22.5871],
            grp: "Локации",
        },
        { id: 147, value: "mogila", label: "Могила", coordinates: [41.1572, 21.4037], grp: "Локации" },
        { id: 148, value: "negotino", label: "Неготино", coordinates: [41.4829, 22.0923], grp: "Локации" },
        { id: 149, value: "novaci", label: "Новаци", coordinates: [41.0443, 21.4589], grp: "Локации" },
        { id: 150, value: "novo_selo", label: "Ново Село", coordinates: [41.4118, 22.8791], grp: "Локации" },
        { id: 151, value: "oslomej", label: "Осломеј", coordinates: [41.5766, 20.998], grp: "Локации" },
        { id: 152, value: "ohrid", label: "Охрид", coordinates: [41.1231, 20.8016], grp: "Локации" },
        { id: 153, value: "petrovec", label: "Петровец", coordinates: [41.9402, 21.6094], grp: "Локации" },
        { id: 154, value: "pehchevo", label: "Пехчево", coordinates: [41.7621, 22.8865], grp: "Локации" },
        { id: 155, value: "plasnica", label: "Пласница", coordinates: [41.4718, 21.122], grp: "Локации" },
        { id: 156, value: "prilep", label: "Прилеп", coordinates: [41.3441, 21.5528], grp: "Локации" },
        { id: 174, value: "shtip", label: "Штип", coordinates: [41.7464, 22.1997], grp: "Локации" },
        { id: 158, value: "radovish", label: "Радовиш", coordinates: [41.6395, 22.4679], grp: "Локации" },
        { id: 159, value: "rankovce", label: "Ранковце", coordinates: [42.1695, 22.1162], grp: "Локации" },
        { id: 160, value: "resen", label: "Ресен", coordinates: [41.0903, 21.0133], grp: "Локации" },
        { id: 161, value: "rosoman", label: "Росоман", coordinates: [41.5176, 21.9433], grp: "Локации" },
        { id: 185, value: "skopje", label: "Скопје", coordinates: [41.9981, 21.4254], grp: "Локации" },
        {
            id: 175,
            value: "skopje-aerodrom",
            label: "Скопје - Аеродром",
            coordinates: [41.98873, 21.45541],
            grp: "Локации",
        },
        { id: 176, value: "skopje-butel", label: "Скопје - Бутел", coordinates: [42.0297, 21.4425], grp: "Локации" },
        {
            id: 177,
            value: "skopje-gazi_baba",
            label: "Скопје - Гази Баба",
            coordinates: [41.9961, 21.4812],
            grp: "Локации",
        },
        {
            id: 178,
            value: "skopje-gjorce_petrov",
            label: "Скопје - Ѓорче Петров",
            coordinates: [42.0003, 21.3653],
            grp: "Локации",
        },
        {
            id: 179,
            value: "skopje-karposh",
            label: "Скопје - Карпош",
            coordinates: [42.003, 21.3978],
            grp: "Локации",
        },
        {
            id: 180,
            value: "skopje-kisela_voda",
            label: "Скопје - Кисела Вода",
            coordinates: [41.9747, 21.4455],
            grp: "Локации",
        },
        { id: 181, value: "skopje-saraj", label: "Скопје - Сарај", coordinates: [41.9994, 21.3247], grp: "Локации" },
        {
            id: 182,
            value: "skopje-skopje_centar",
            label: "Скопје - Центар",
            coordinates: [41.9954, 21.4246],
            grp: "Локации",
        },
        { id: 183, value: "skopje-chair", label: "Скопје - Чаир", coordinates: [42.0108, 21.4425], grp: "Локации" },
        {
            id: 184,
            value: "skopje-shuto_orizari",
            label: "Скопје - Шуто Оризари",
            coordinates: [42.038, 21.4246],
            grp: "Локации",
        },
        {
            id: 162,
            value: "staro_nagoricane",
            label: "Старо Нагоричане",
            coordinates: [42.2002, 21.8285],
            grp: "Локации",
        },
        { id: 163, value: "sveti_nikole", label: "Свети Николе", coordinates: [41.8656, 21.9373], grp: "Локации" },
        { id: 164, value: "sopishte", label: "Сопиште", coordinates: [41.95, 21.4201], grp: "Локации" },
        { id: 165, value: "struga", label: "Струга", coordinates: [41.1778, 20.6783], grp: "Локации" },
        { id: 166, value: "strumica", label: "Струмица", coordinates: [41.4378, 22.6427], grp: "Локации" },
        { id: 167, value: "studenichani", label: "Студеничани", coordinates: [41.8073, 21.4037], grp: "Локации" },
        { id: 168, value: "tearce", label: "Теарце", coordinates: [42.0778, 21.0535], grp: "Локации" },
        { id: 169, value: "tetovo", label: "Тетово", coordinates: [42.0069, 20.9715], grp: "Локации" },
        { id: 170, value: "centar_zhupa", label: "Центар Жупа", coordinates: [41.4785, 20.5603], grp: "Локации" },
        { id: 171, value: "chashka", label: "Чашка", coordinates: [44.7893, 93.6018], grp: "Локации" },
        {
            id: 172,
            value: "cheshinovo_obleshevo",
            label: "Чешиново и Облешево",
            coordinates: [41.892, 22.3099],
            grp: "Локации",
        },
        {
            id: 173,
            value: "chucher_sandevo",
            label: "Чучер Сандево",
            coordinates: [42.0975, 21.3877],
            grp: "Локации",
        },

        { id: 157, value: "probishtip", label: "Пробиштип", coordinates: [41.9948, 22.1877], grp: "Локации" },
    ],
    sq: [
        // { id: 1850, value: "skopje", label: "Skopje", coordinates: [41.9981, 21.4254], grp: "Popullore" },
        // { id: 1520, value: "ohrid", label: "Ohrid", coordinates: [41.1231, 20.8016], grp: "Popullore" },
        // { id: 1030, value: "bitola", label: "Bitola", coordinates: [41.0297, 21.3292], grp: "Popullore" },
        {
            id: 101,
            value: "arachinovo",
            label: "Arachinovo",
            coordinates: [41.9940273, 21.5252175],
            grp: "Vendndodhjet",
        },
        { id: 102, value: "berovo", label: "Berovo", coordinates: [41.7061, 22.8552], grp: "Vendndodhjet" },
        { id: 103, value: "bitola", label: "Bitola", coordinates: [41.0297, 21.3292], grp: "Vendndodhjet" },
        { id: 104, value: "bogdanci", label: "Bogdanci", coordinates: [41.2031, 22.5754], grp: "Vendndodhjet" },
        { id: 105, value: "bogovinje", label: "Bogovinje", coordinates: [41.9236, 20.9164], grp: "Vendndodhjet" },
        { id: 106, value: "bosilovo", label: "Bosilovo", coordinates: [41.439, 22.7316], grp: "Vendndodhjet" },
        { id: 107, value: "brvenica", label: "Brvenica", coordinates: [41.9681, 20.982], grp: "Vendndodhjet" },
        { id: 108, value: "valandovo", label: "Valandovo", coordinates: [41.317, 22.5618], grp: "Vendndodhjet" },
        { id: 109, value: "vasilevo", label: "Vasilevo", coordinates: [41.4742, 22.6422], grp: "Vendndodhjet" },
        { id: 110, value: "vevcani", label: "Vevcani", coordinates: [41.2408, 20.5916], grp: "Vendndodhjet" },
        { id: 111, value: "veles", label: "Veles", coordinates: [41.7165, 21.7723], grp: "Vendndodhjet" },
        { id: 112, value: "vinica", label: "Vinica", coordinates: [41.8833, 22.5081], grp: "Vendndodhjet" },
        { id: 113, value: "vranestica", label: "Vranestica", coordinates: [41.4453, 21.0259], grp: "Vendndodhjet" },
        { id: 114, value: "vrapciste", label: "Vrapciste", coordinates: [41.8384, 20.8858], grp: "Vendndodhjet" },
        { id: 115, value: "gevgelija", label: "Gevgelija", coordinates: [41.1452, 22.4997], grp: "Vendndodhjet" },
        { id: 116, value: "gostivar", label: "Gostivar", coordinates: [41.8026, 20.9089], grp: "Vendndodhjet" },
        { id: 117, value: "gradsko", label: "Gradsko", coordinates: [41.5751, 21.9495], grp: "Vendndodhjet" },
        { id: 118, value: "debar", label: "Debar", coordinates: [41.5198, 20.5289], grp: "Vendndodhjet" },
        { id: 119, value: "debarca", label: "Debarca", coordinates: [41.3584, 20.8553], grp: "Vendndodhjet" },
        { id: 120, value: "delcevo", label: "Delcevo", coordinates: [41.9709, 22.774], grp: "Vendndodhjet" },
        { id: 121, value: "demir_kapija", label: "Demir Kapija", coordinates: [41.4088, 22.2436], grp: "Vendndodhjet" },
        { id: 122, value: "demir_hisar", label: "Demir Hisar", coordinates: [41.2214, 21.2025], grp: "Vendndodhjet" },
        { id: 123, value: "dojran", label: "Dojran", coordinates: [41.1811, 22.7227], grp: "Vendndodhjet" },
        { id: 124, value: "dolneni", label: "Dolneni", coordinates: [41.427, 21.4529], grp: "Vendndodhjet" },
        { id: 125, value: "drugovo", label: "Drugovo", coordinates: [41.4408, 20.9268], grp: "Vendndodhjet" },
        { id: 126, value: "zhelino", label: "Zhelino", coordinates: [41.9803, 21.0609], grp: "Vendndodhjet" },
        { id: 127, value: "zajas", label: "Zajas", coordinates: [41.5983, 20.9417], grp: "Vendndodhjet" },
        { id: 128, value: "zelenikovo", label: "Zelenikovo", coordinates: [41.8831, 21.5893], grp: "Vendndodhjet" },
        { id: 129, value: "zrnovci", label: "Zrnovci", coordinates: [41.8541, 22.4438], grp: "Vendndodhjet" },
        { id: 130, value: "ilinden", label: "Ilinden", coordinates: [41.9957, 21.5677], grp: "Vendndodhjet" },
        { id: 131, value: "jegunovce", label: "Jegunovce", coordinates: [42.0741, 21.122], grp: "Vendndodhjet" },
        { id: 132, value: "kavadarci", label: "Kavadarci", coordinates: [41.4329, 22.0089], grp: "Vendndodhjet" },
        { id: 133, value: "karbinci", label: "Karbinci", coordinates: [41.818, 22.2325], grp: "Vendndodhjet" },
        { id: 134, value: "kichevo", label: "Kichevo", coordinates: [41.5129, 20.9525], grp: "Vendndodhjet" },
        { id: 135, value: "konche", label: "Konche", coordinates: [41.4966, 22.383], grp: "Vendndodhjet" },
        { id: 136, value: "kochani", label: "Kochani", coordinates: [41.9168, 22.4083], grp: "Vendndodhjet" },
        { id: 137, value: "kratovo", label: "Kratovo", coordinates: [42.08, 22.1803], grp: "Vendndodhjet" },
        {
            id: 138,
            value: "kriva_palanka",
            label: "Kriva Palanka",
            coordinates: [42.2058, 22.3308],
            grp: "Vendndodhjet",
        },
        {
            id: 139,
            value: "krivogashtani",
            label: "Krivogashtani",
            coordinates: [41.3373, 21.3292],
            grp: "Vendndodhjet",
        },
        { id: 140, value: "krushevo", label: "Krushevo", coordinates: [41.3706, 21.2502], grp: "Vendndodhjet" },
        { id: 141, value: "kumanovo", label: "Kumanovo", coordinates: [42.1323, 21.7257], grp: "Vendndodhjet" },
        { id: 142, value: "lipkovo", label: "Lipkovo", coordinates: [42.1561, 21.5871], grp: "Vendndodhjet" },
        { id: 143, value: "lozovo", label: "Lozovo", coordinates: [41.7818, 21.9001], grp: "Vendndodhjet" },
        {
            id: 144,
            value: "mavrovo_rostusha",
            label: "Mavrovo and Rostusha",
            coordinates: [41.6545, 20.734],
            grp: "Vendndodhjet",
        },
        {
            id: 145,
            value: "makedonski_brod",
            label: "Makedonski Brod",
            coordinates: [41.5133, 21.2174],
            grp: "Vendndodhjet",
        },
        {
            id: 146,
            value: "makedonska_kamenica",
            label: "Makedonska Kamenica",
            coordinates: [42.0214, 22.5871],
            grp: "Vendndodhjet",
        },
        { id: 147, value: "mogila", label: "Mogila", coordinates: [41.1572, 21.4037], grp: "Vendndodhjet" },
        { id: 148, value: "negotino", label: "Negotino", coordinates: [41.4829, 22.0923], grp: "Vendndodhjet" },
        { id: 149, value: "novaci", label: "Novaci", coordinates: [41.0443, 21.4589], grp: "Vendndodhjet" },
        { id: 150, value: "novo selo", label: "Novo Selo", coordinates: [41.4118, 22.8791], grp: "Vendndodhjet" },
        { id: 151, value: "oslomej", label: "Oslomej", coordinates: [41.5766, 20.998], grp: "Vendndodhjet" },
        { id: 152, value: "ohrid", label: "Ohrid", coordinates: [41.1231, 20.8016], grp: "Vendndodhjet" },
        { id: 153, value: "petrovec", label: "Petrovec", coordinates: [41.9402, 21.6094], grp: "Vendndodhjet" },
        { id: 154, value: "pehchevo", label: "Pehchevo", coordinates: [41.7621, 22.8865], grp: "Vendndodhjet" },
        { id: 155, value: "plasnica", label: "Plasnica", coordinates: [41.4718, 21.122], grp: "Vendndodhjet" },
        { id: 156, value: "prilep", label: "Prilep", coordinates: [41.3441, 21.5528], grp: "Vendndodhjet" },
        { id: 174, value: "shtip", label: "Shtip", coordinates: [41.7464, 22.1997], grp: "Vendndodhjet" },
        { id: 158, value: "radovish", label: "Radovish", coordinates: [41.6395, 22.4679], grp: "Vendndodhjet" },
        { id: 159, value: "rankovce", label: "Rankovce", coordinates: [42.1695, 22.1162], grp: "Vendndodhjet" },
        { id: 160, value: "resen", label: "Resen", coordinates: [41.0903, 21.0133], grp: "Vendndodhjet" },
        { id: 161, value: "rosoman", label: "Rosoman", coordinates: [41.5176, 21.9433], grp: "Vendndodhjet" },
        {
            id: 162,
            value: "staro_nagoricane",
            label: "Staro Nagoricane",
            coordinates: [42.2002, 21.8285],
            grp: "Vendndodhjet",
        },
        { id: 163, value: "sveti_nikole", label: "Sveti Nikole", coordinates: [41.8656, 21.9373], grp: "Vendndodhjet" },
        { id: 164, value: "sopishte", label: "Sopishte", coordinates: [41.95, 21.4201], grp: "Vendndodhjet" },
        { id: 165, value: "struga", label: "Struga", coordinates: [41.1778, 20.6783], grp: "Vendndodhjet" },
        { id: 166, value: "strumica", label: "Strumica", coordinates: [41.4378, 22.6427], grp: "Vendndodhjet" },
        { id: 167, value: "studenichani", label: "Studenichani", coordinates: [41.8073, 21.4037], grp: "Vendndodhjet" },
        { id: 168, value: "tearce", label: "Tearce", coordinates: [42.0778, 21.0535], grp: "Vendndodhjet" },
        { id: 169, value: "tetovo", label: "Tetovo", coordinates: [42.0069, 20.9715], grp: "Vendndodhjet" },
        { id: 170, value: "centar_zhupa", label: "Centar Zhupa", coordinates: [41.4785, 20.5603], grp: "Vendndodhjet" },
        { id: 171, value: "chashka", label: "Chashka", coordinates: [44.7893, 93.6018], grp: "Vendndodhjet" },
        {
            id: 172,
            value: "cheshinovo_obleshevo",
            label: "Cheshinovo and Obleshevo",
            coordinates: [41.892, 22.3099],
            grp: "Vendndodhjet",
        },
        {
            id: 173,
            value: "chucher_sandevo",
            label: "Chucher Sandevo",
            coordinates: [42.0975, 21.3877],
            grp: "Vendndodhjet",
        },
        { id: 157, value: "probishtip", label: "Probishtip", coordinates: [41.9948, 22.1877], grp: "Vendndodhjet" },
        { id: 185, value: "skopje", label: "Skopje", coordinates: [41.9981, 21.4254], grp: "Vendndodhjet" },
        {
            id: 175,
            value: "skopje-aerodrom",
            label: "Skopje - Aerodrom",
            coordinates: [41.98873, 21.45541],
            grp: "Vendndodhjet",
        },
        {
            id: 176,
            value: "skopje-butel",
            label: "Skopje - Butel",
            coordinates: [42.0297, 21.4425],
            grp: "Vendndodhjet",
        },
        {
            id: 177,
            value: "skopje-gazi_baba",
            label: "Skopje - Gazi Baba",
            coordinates: [41.9961, 21.4812],
            grp: "Vendndodhjet",
        },
        {
            id: 178,
            value: "skopje-gjorce_petrov",
            label: "Skopje - Gjorce Petrov",
            coordinates: [42.0003, 21.3653],
            grp: "Vendndodhjet",
        },
        {
            id: 179,
            value: "skopje-karposh",
            label: "Skopje - Karposh",
            coordinates: [42.003, 21.3978],
            grp: "Vendndodhjet",
        },
        {
            id: 180,
            value: "skopje-kisela_voda",
            label: "Skopje - Kisela Voda",
            coordinates: [41.9747, 21.4455],
            grp: "Vendndodhjet",
        },
        {
            id: 181,
            value: "skopje-saraj",
            label: "Skopje - Saraj",
            coordinates: [41.9994, 21.3247],
            grp: "Vendndodhjet",
        },
        {
            id: 182,
            value: "skopje-skopje_centar",
            label: "Skopje - Centar",
            coordinates: [41.9954, 21.4246],
            grp: "Vendndodhjet",
        },
        {
            id: 183,
            value: "skopje-chair",
            label: "Skopje - Chair",
            coordinates: [42.0108, 21.4425],
            grp: "Vendndodhjet",
        },
        {
            id: 184,
            value: "skopje-shuto_orizari",
            label: "Skopje - Shuto Orizari",
            coordinates: [42.038, 21.4246],
            grp: "Vendndodhjet",
        },
    ],
}

const districtTransliterationMap = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    ѓ: "gj",
    е: "e",
    ж: "zh",
    з: "z",
    ѕ: "dz",
    и: "i",
    ј: "j",
    к: "k",
    л: "l",
    љ: "lj",
    м: "m",
    н: "n",
    њ: "nj",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    ќ: "kj",
    у: "u",
    ф: "f",
    х: "h",
    ц: "c",
    ч: "ch",
    џ: "dj",
    ш: "sh",
}

MacedonianPropertyLocationDictionary.tr = MacedonianPropertyLocationDictionary.en.map(entry => ({
    ...entry,
    grp: "Lokasyonlar",
}))

const districtToValue = label =>
    label
        .toLowerCase()
        .replace(/đ/g, "dj")
        .replace(/ł/g, "l")
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .split("")
        .map(char => districtTransliterationMap[char] ?? char)
        .join("")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")

const createDistrictOptions = (cityKey, labels) =>
    labels.map((label, index) => ({
        id: `${cityKey}-${index + 1}`,
        value: districtToValue(label),
        label,
    }))

const getMunicipalityLabel = (entry, locale) => {
    if (typeof entry === "string") return entry

    return entry[locale] || entry.en || entry.mk || entry.sq
}

const createCountryLocationOptions = (entries, idOffset, locale) =>
    entries.map((entry, index) => {
        const label = getMunicipalityLabel(entry, locale)
        const enLabel = getMunicipalityLabel(entry, "en")

        return {
            id: idOffset + index + 1,
            value: districtToValue(enLabel),
            label,
            coordinates: typeof entry === "string" ? null : entry.coordinates || null,
            grp: "Locations",
        }
    })

export const DEFAULT_PROPERTY_COUNTRY = PropertyCountry.macedonia

export const PropertyCountryDictionary = {
    en: [
        { value: PropertyCountry.macedonia, label: "North Macedonia" },
        { value: PropertyCountry.serbia, label: "Serbia" },
        { value: PropertyCountry.albania, label: "Albania" },
        { value: PropertyCountry.greece, label: "Greece" },
        { value: PropertyCountry.bulgaria, label: "Bulgaria" },
    ],
    mk: [
        { value: PropertyCountry.macedonia, label: "Македонија" },
        { value: PropertyCountry.serbia, label: "Србија" },
        { value: PropertyCountry.albania, label: "Албанија" },
        { value: PropertyCountry.greece, label: "Грција" },
        { value: PropertyCountry.bulgaria, label: "Бугарија" },
    ],
    sq: [
        { value: PropertyCountry.macedonia, label: "Maqedonia e Veriut" },
        { value: PropertyCountry.serbia, label: "Serbia" },
        { value: PropertyCountry.albania, label: "Shqipëria" },
        { value: PropertyCountry.greece, label: "Greqia" },
        { value: PropertyCountry.bulgaria, label: "Bullgaria" },
    ],
    tr: [
        { value: PropertyCountry.macedonia, label: "Kuzey Makedonya" },
        { value: PropertyCountry.serbia, label: "Sırbistan" },
        { value: PropertyCountry.albania, label: "Arnavutluk" },
        { value: PropertyCountry.greece, label: "Yunanistan" },
        { value: PropertyCountry.bulgaria, label: "Bulgaristan" },
    ],
}

const createLocalizedCountryLocations = (entries, idOffset) => {
    return {
        en: createCountryLocationOptions(entries, idOffset, "en"),
        mk: createCountryLocationOptions(entries, idOffset, "mk"),
        sq: createCountryLocationOptions(entries, idOffset, "sq"),
        tr: createCountryLocationOptions(entries, idOffset, "en").map(entry => ({ ...entry, grp: "Lokasyonlar" })),
    }
}

export const PropertyLocationDictionaryByCountry = {
    [PropertyCountry.macedonia]: MacedonianPropertyLocationDictionary,
    [PropertyCountry.serbia]: createLocalizedCountryLocations(SerbiaMunicipalityEntries, 3000),
    [PropertyCountry.albania]: createLocalizedCountryLocations(AlbaniaMunicipalityEntries, 5000),
    [PropertyCountry.greece]: createLocalizedCountryLocations(GreeceMunicipalityEntries, 7000),
    [PropertyCountry.bulgaria]: createLocalizedCountryLocations(BulgariaMunicipalityEntries, 9000),
}

export const PropertyLocationDictionary = PropertyLocationDictionaryByCountry[PropertyCountry.macedonia]

const MacedonianPropertyDistrictDictionary = {
    ohrid: createDistrictOptions("ohrid", [
        "7-ми Ноември",
        "Бејбунар",
        "Билјанини Извори",
        "Богомилска",
        "Варош",
        "Видобишта",
        "Влашка Маала",
        "Воска",
        "Далјан",
        "Канео",
        "Карабегомала",
        "Кошишта",
        "Студенчишта",
        "Лескајца",
        "Месокастро",
        "Радојца Новичиќ",
        "Расадник",
        "Христо Узунов",
        "Центар",
        "Чекоштина",
        "Други населени места и села",
    ]),
    "skopje-skopje_centar": createDistrictOptions("skopje-skopje_centar", [
        "Буњаковец",
        "Водно",
        "Градски Парк",
        "Дебар Маало",
        "Капиштец",
        "Крњево",
        "Маџир Маало",
        "Ново Маало",
        "Пролет",
        "Тасино Чешмиче",
        "Центар",
    ]),
    "skopje-karposh": createDistrictOptions("skopje-karposh", [
        "Бардовци",
        "Влае 1",
        "Влае 2",
        "Жданец",
        "Злокуќани",
        "Карпош 1",
        "Карпош 2",
        "Карпош 3",
        "Карпош 4",
        "Козле",
        "Момин Поток",
        "Нерези",
        "Тафталиџе 1",
        "Тафталиџе 2",
        "Трнодол",
        "Момин Поток",
    ]),
    "skopje-aerodrom": createDistrictOptions("skopje-aerodrom", [
        "Аеродром",
        "Горно Лисиче",
        "Долно Лисиче",
        "Јане Сандански",
        "Лисиче",
        "Мичурин",
        "Ново Лисиче",
        "Острово",
        "Реонски Центар",
        "Стар Аеродром",
    ]),
    "skopje-kisela_voda": createDistrictOptions("skopje-kisela_voda", [
        "11 Октомври",
        "Бирарија",
        "Драчево",
        "Кисела Вода",
        "Пинтија",
        "Пржино",
        "Припор",
        "Расадник",
        "Рампа",
        "Стаклара",
        "Теферич",
        "Усје",
        "Чешма",
        "Црниче",
    ]),
    "skopje-gazi_baba": createDistrictOptions("skopje-gazi_baba", [
        "Автокоманда",
        "Гази Баба",
        "Железара",
        "Инџиково",
        "Јурумлери",
        "Маџари",
        "Сингелиќ",
        "Стајковци",
        "Триангла",
        "Трубарево",
        "Ќерамидница",
        "Хиподром",
        "Ченто",
    ]),
    "skopje-gjorce_petrov": createDistrictOptions("skopje-gjorce_petrov", [
        "Волково",
        "Ге-Ге",
        "Даме Груев",
        "Дексион",
        "Ѓорче Петров",
        "Кисела Јабука",
        "Ново Село",
        "Орман",
        "Стопански Двор",
        "Хром",
    ]),
    "skopje-chair": createDistrictOptions("skopje-chair", [
        "Бит Пазар",
        "Дуќанџик",
        "Серава",
        "Топаана",
        "Топанско Поле",
        "Јаја Паша",
        "Чаир",
    ]),
    "skopje-butel": createDistrictOptions("skopje-butel", [
        "Бутел 1",
        "Бутел 2",
        "Визбегово",
        "Љубанци",
        "Љуботен",
        "Љуботенски Пат",
        "Радишани",
        "Скопје Север",
    ]),
    "skopje-shuto_orizari": createDistrictOptions("skopje-shuto_orizari", ["Долно Оризари", "Шуто Оризари"]),
    "skopje-saraj": createDistrictOptions("skopje-saraj", ["Глумово", "Кондово", "Љубин", "Матка", "Сарај", "Шишево"]),
}

const transliterateDistrictLabel = label =>
    label
        .split("")
        .map(char => {
            const mapped = districtTransliterationMap[char.toLowerCase()]
            if (!mapped) return char
            return char === char.toLowerCase() ? mapped : mapped.charAt(0).toUpperCase() + mapped.slice(1)
        })
        .join("")

const createLocalizedDistrictDictionary = mkDictionary => {
    const latinDictionary = Object.fromEntries(
        Object.entries(mkDictionary).map(([cityKey, options]) => [
            cityKey,
            options.map(option => ({ ...option, label: transliterateDistrictLabel(option.label) })),
        ])
    )

    // Districts have no official EN/SQ/TR translations, only Latin transliterations
    // (same approach used for municipality names above).
    return {
        mk: mkDictionary,
        en: latinDictionary,
        sq: latinDictionary,
        tr: latinDictionary,
    }
}

export const PropertyDistrictDictionaryByCountry = {
    [PropertyCountry.macedonia]: createLocalizedDistrictDictionary(MacedonianPropertyDistrictDictionary),
    [PropertyCountry.serbia]: {},
    [PropertyCountry.albania]: {},
    [PropertyCountry.greece]: {},
    [PropertyCountry.bulgaria]: {},
}

export const PropertyDistrictDictionary = PropertyDistrictDictionaryByCountry[PropertyCountry.macedonia].mk

export const getValidPropertyCountry = country =>
    Object.values(PropertyCountry).includes(country) ? country : DEFAULT_PROPERTY_COUNTRY

export const getPropertyLocationsByCountry = (country, locale = "mk") => [
    ...(PropertyLocationDictionaryByCountry[getValidPropertyCountry(country)]?.[locale] || []),
]

export const getPropertyDistrictsByCountryLocation = (country, location, locale = "mk") => [
    ...(PropertyDistrictDictionaryByCountry[getValidPropertyCountry(country)]?.[locale]?.[location] || []),
]

export const isPropertyLocationValidForCountry = (country, locale, location) =>
    getPropertyLocationsByCountry(country, locale).some(option => option.value === location)

/**
 * Property features dictionary
 *
 * IMPORTANT: This array is sorted alphabetically by Macedonian translation (А-Ш)
 * to ensure consistent display order across the application.
 *
 * To re-sort after adding new features:
 * 1. Add the feature name and visible array to this dictionary
 * 2. Add Macedonian translation to messages/mk.json under "Common"
 * 3. Run: node scripts/sort_property_features.js
 * 4. Manually update this array with the sorted order from script output
 *
 * Each feature has:
 * - name: Translation key (must match key in messages/[locale].json)
 * - visible: Array of PropertyType enums where this feature applies
 */
export const PropertyFeaturesDictionary = [
    // Базен
    {
        name: "pool",
        visible: [PropertyType.flat, PropertyType.house, PropertyType.holiday_home],
    },
    // Балкон/Тераса
    {
        name: "balcony",
        visible: [PropertyType.flat, PropertyType.house, PropertyType.holiday_home],
    },
    // Во добра состојба
    {
        name: "goodCondition",
        visible: [
            PropertyType.flat,
            PropertyType.house,
            PropertyType.holiday_home,
            PropertyType.commercial,
            PropertyType.garage,
        ],
    },
    // Градина
    {
        name: "garden",
        visible: [PropertyType.flat, PropertyType.house, PropertyType.holiday_home],
    },
    // Греење
    {
        name: "heating",
        visible: [
            PropertyType.flat,
            PropertyType.house,
            PropertyType.holiday_home,
            PropertyType.commercial,
            PropertyType.garage,
        ],
    },
    // Домашни миленичиња
    {
        name: "petFriendly",
        visible: [PropertyType.flat, PropertyType.holiday_home, PropertyType.house],
    },
    // Дрвени подови
    {
        name: "woodenFloors",
        visible: [PropertyType.flat, PropertyType.house, PropertyType.holiday_home],
    },
    // Звучна изолација
    {
        name: "soundProofing",
        visible: [PropertyType.flat, PropertyType.house, PropertyType.holiday_home, PropertyType.commercial],
    },
    // Интерфон
    {
        name: "interphone",
        visible: [PropertyType.flat, PropertyType.house, PropertyType.holiday_home, PropertyType.commercial],
    },
    // Камин
    {
        name: "fireplace",
        visible: [PropertyType.flat, PropertyType.house, PropertyType.holiday_home],
    },
    // Клима уред
    {
        name: "airCon",
        visible: [
            PropertyType.flat,
            PropertyType.house,
            PropertyType.holiday_home,
            PropertyType.commercial,
            PropertyType.garage,
        ],
    },
    // Комплетно опремено
    {
        name: "fullyEquipped",
        visible: [PropertyType.flat, PropertyType.holiday_home, PropertyType.house, PropertyType.commercial],
    },
    // Користено
    {
        name: "used",
        visible: [
            PropertyType.flat,
            PropertyType.house,
            PropertyType.holiday_home,
            PropertyType.commercial,
            PropertyType.garage,
        ],
    },
    // Користено, но во добра состојба
    {
        name: "usedButGoodCondition",
        visible: [
            PropertyType.flat,
            PropertyType.house,
            PropertyType.holiday_home,
            PropertyType.commercial,
            PropertyType.garage,
        ],
    },
    // Кујна
    {
        name: "kitchen",
        visible: [PropertyType.flat, PropertyType.house, PropertyType.holiday_home, PropertyType.commercial],
    },
    // Лифт
    {
        name: "elevator",
        visible: [PropertyType.flat, PropertyType.house, PropertyType.holiday_home, PropertyType.commercial],
    },
    // Мебел
    {
        name: "furnished",
        visible: [PropertyType.flat, PropertyType.house, PropertyType.holiday_home],
    },
    // Ново
    {
        name: "new",
        visible: [
            PropertyType.flat,
            PropertyType.house,
            PropertyType.holiday_home,
            PropertyType.commercial,
            PropertyType.garage,
        ],
    },
    // Паркинг
    {
        name: "parking",
        visible: [PropertyType.flat, PropertyType.house, PropertyType.commercial, PropertyType.holiday_home],
    },
    // Подрум
    {
        name: "cellar",
        visible: [PropertyType.flat, PropertyType.house, PropertyType.holiday_home],
    },
    // Полунаместено
    {
        name: "halfEmpty",
        visible: [PropertyType.flat, PropertyType.house, PropertyType.commercial, PropertyType.holiday_home],
    },
    // Помошна просторија
    {
        name: "utilityRoom",
        visible: [PropertyType.commercial, PropertyType.flat, PropertyType.holiday_home, PropertyType.house],
    },
    // Парно
    {
        name: "personalHeating",
        visible: [PropertyType.flat, PropertyType.house, PropertyType.holiday_home, PropertyType.commercial],
    },
    // Празно
    {
        name: "empty",
        visible: [PropertyType.flat, PropertyType.house, PropertyType.commercial, PropertyType.holiday_home],
    },
    // Реновирано
    {
        name: "renovated",
        visible: [
            PropertyType.flat,
            PropertyType.house,
            PropertyType.holiday_home,
            PropertyType.commercial,
            PropertyType.garage,
        ],
    },
    // Систем за безбедност
    {
        name: "securitySystem",
        visible: [
            PropertyType.flat,
            PropertyType.house,
            PropertyType.holiday_home,
            PropertyType.commercial,
            PropertyType.garage,
        ],
    },
    // Соба за конференции
    {
        name: "conferenceRoom",
        visible: [PropertyType.commercial],
    },
    // Соба за рекреација
    {
        name: "recreationalRoom",
        visible: [PropertyType.commercial],
    },
    // Соба за сервери
    {
        name: "serverRoom",
        visible: [PropertyType.commercial],
    },
    // Соларни панели
    {
        name: "solarPanels",
        visible: [PropertyType.flat, PropertyType.house, PropertyType.holiday_home],
    },
    // Теретана
    {
        name: "gym",
        visible: [PropertyType.flat, PropertyType.house, PropertyType.holiday_home],
    },
    // Централно греење
    {
        name: "centralHeating",
        visible: [PropertyType.flat, PropertyType.house, PropertyType.commercial, PropertyType.holiday_home],
    },
    // Short-term rent only (listingTypes limits where they show; stored in attributes like every other amenity)
    ...[
        "babyCrib",
        "wifi",
        "tv",
        "washingMachine",
        "dishwasher",
        "linensAndTowels",
        "workspace",
        "selfCheckIn",
        "bbq",
        "smokingAllowed",
    ].map(name => ({
        name,
        visible: [PropertyType.flat, PropertyType.house, PropertyType.holiday_home],
        listingTypes: [PropertyListingType.short_term_rent],
    })),
]

export const PropertyTypeDictionary = {
    en: [
        {
            id: "1",
            value: PropertyType.flat,
            label: "Flat",
            pluralLabel: "Flats",
            url: `${ROUTE_URL.SEARCH_PROPERTIES_FOR_SALE}/stanovi`,
            queryParams: {
                listingType: PropertyListingType.for_sale,
                category: "1",
            },
            subcategories: [
                { id: "101", label: "Studio", value: "STUDIO" },
                { id: "102", label: "Apartment", value: "APARTMENT" },
                { id: "103", label: "Penthouse", value: "PENTHOUSE" },
                { id: "104", label: "Duplex", value: "DUPLEX" },
                { id: "108", label: "Condo", value: "CONDO" },
                { id: "109", label: "Garden apartment", value: "GARDEN_APARTMENT" },
                { id: "110", label: "Luxury apartment", value: "LUXURY_APARTMENT" },
                { id: "111", label: "House section", value: "FLAT_SECTION" },
                { id: "112", label: "House floor", value: "FLAT_FLOOR" },
                { id: "113", label: "Gallery", value: "FLAT_GALLERY" },
            ],
        },
        {
            id: "2",
            value: PropertyType.house,
            label: "House",
            pluralLabel: "Houses",
            url: `${ROUTE_URL.SEARCH_PROPERTIES_FOR_SALE}/kuki`,
            queryParams: {
                listingType: PropertyListingType.for_sale,
                category: "2",
            },
            subcategories: [
                { id: "201", label: "Detached", value: "DETACHED" },
                { id: "202", label: "Semi-detached", value: "SEMI_DETACHED" },
                { id: "203", label: "Villa", value: "VILLA" },
                { id: "204", label: "Bungalow", value: "BUNGALOW" },
                { id: "205", label: "Barracks", value: "BARRACKS" },
                { id: "206", label: "Cottage", value: "COTTAGE" },
                { id: "207", label: "Townhouse", value: "TOWNHOUSE" },
                { id: "208", label: "Farmhouse", value: "FARMHOUSE" },
                { id: "209", label: "Multi-Family House", value: "MULTI_FAMILY_HOUSE" },
                { id: "210", label: "House section", value: "HOUSE_SECTION" },
                { id: "211", label: "House Floor", value: "HOUSE_FLOOR" },
            ],
        },
        {
            id: "3",
            value: PropertyType.holiday_home,
            label: "Holiday Home",
            pluralLabel: "Holiday Homes",
            url: `${ROUTE_URL.SEARCH_PROPERTIES_FOR_SALE}/vikendici`,
            queryParams: {
                listingType: PropertyListingType.for_sale,
                category: "3",
            },
            subcategories: [
                { id: "301", label: "Beach House", value: "BEACH_HOUSE" },
                { id: "302", label: "Mountain Cabin", value: "MOUNTAIN_CABIN" },
                { id: "303", label: "Country Cottage", value: "COUNTRY_COTTAGE" },
                { id: "304", label: "Lake House", value: "LAKE_HOUSE" },
            ],
        },
        {
            id: "4",
            value: PropertyType.land,
            label: "Land",
            pluralLabel: "Lands",
            url: `${ROUTE_URL.SEARCH_PROPERTIES_FOR_SALE}/zemjista`,
            queryParams: {
                listingType: PropertyListingType.for_sale,
                category: "4",
            },
            subcategories: [
                { id: "401", label: "Residential Plot", value: "RESIDENTIAL_PLOT" },
                { id: "402", label: "Agricultural Land", value: "AGRICULTURAL_LAND" },
                { id: "403", label: "Commercial Plot", value: "COMMERCIAL_PLOT" },
                { id: "404", label: "Industrial Plot", value: "INDUSTRIAL_PLOT" },
                { id: "405", label: "Forest Land", value: "FOREST_LAND" },
                { id: "406", label: "Recreational Plot", value: "RECREATIONAL_PLOT" },
            ],
        },
        {
            id: "5",
            value: PropertyType.garage,
            label: "Garage",
            pluralLabel: "Garages",
            url: `${ROUTE_URL.SEARCH_PROPERTIES_FOR_SALE}/garazi`,
            queryParams: {
                listingType: PropertyListingType.for_sale,
                category: "5",
            },
            subcategories: [
                { id: "501", label: "Single Garage", value: "SINGLE_GARAGE" },
                { id: "502", label: "Double Garage", value: "DOUBLE_GARAGE" },
                { id: "503", label: "Underground Parking", value: "UNDERGROUND_PARKING" },
                { id: "504", label: "Carport", value: "CARPORT" },
                { id: "505", label: "Garage Unit", value: "GARAGE_UNIT" },
                { id: "506", label: "Multi-Car Garage", value: "MULTI_CAR_GARAGE" },
            ],
        },
        {
            id: "6",
            value: PropertyType.commercial,
            label: "Commercial",
            pluralLabel: "Commercial Properties",
            url: `${ROUTE_URL.SEARCH_PROPERTIES_FOR_SALE}/prostori`,
            queryParams: {
                listingType: PropertyListingType.for_sale,
                category: "6",
            },
            subcategories: [
                { id: "601", label: "Office", value: "OFFICE" },
                { id: "602", label: "Retail", value: "RETAIL" },
                { id: "608", label: "Retail shop", value: "RETAIL_SHOP" },
                { id: "603", label: "Industrial", value: "INDUSTRIAL" },
                { id: "604", label: "Warehouse/Storage", value: "WAREHOUSE" },
                { id: "605", label: "Restaurant/Hotel/Bar", value: "HOSPITALITY" },
                { id: "606", label: "Co-Working Space", value: "COWORKING_SPACE" },
                { id: "607", label: "Showroom", value: "SHOWROOM" },
            ],
        },
    ],
    mk: [
        {
            id: "1",
            value: PropertyType.flat,
            label: "Стан",
            pluralLabel: "Станови",
            url: `${ROUTE_URL.SEARCH_PROPERTIES_FOR_SALE}/stanovi`,
            queryParams: {
                listingType: PropertyListingType.for_sale,
                category: "1",
            },
            subcategories: [
                { id: "101", label: "Гарсоњера", value: "STUDIO" },
                { id: "102", label: "Апартман", value: "APARTMENT" },
                { id: "103", label: "Пентхаус", value: "PENTHOUSE" },
                { id: "104", label: "Дуплекс", value: "DUPLEX" },
                { id: "108", label: "Кондоминиум", value: "CONDO" },
                { id: "109", label: "Стан со градина", value: "GARDEN_APARTMENT" },
                { id: "110", label: "Луксузен стан", value: "LUXURY_APARTMENT" },
                { id: "111", label: "Дел од куќа", value: "FLAT_SECTION" },
                { id: "112", label: "Спрат од куќа", value: "FLAT_FLOOR" },
                { id: "113", label: "Стан со галерија", value: "FLAT_GALLERY" },
            ],
        },
        {
            id: "2",
            value: PropertyType.house,
            label: "Куќа",
            pluralLabel: "Куќи",
            url: `${ROUTE_URL.SEARCH_PROPERTIES_FOR_SALE}/kuki`,
            queryParams: {
                listingType: PropertyListingType.for_sale,
                category: "2",
            },
            subcategories: [
                { id: "201", label: "Самостојна куќа", value: "DETACHED" },
                { id: "202", label: "Лепенка", value: "SEMI_DETACHED" },
                { id: "203", label: "Вила", value: "VILLA" },
                { id: "204", label: "Бунгалов", value: "BUNGALOW" },
                { id: "205", label: "Барака", value: "BARRACKS" },
                { id: "206", label: "Селска куќа", value: "COTTAGE" },
                { id: "207", label: "Градска куќа", value: "TOWNHOUSE" },
                { id: "208", label: "Куќа на фарма", value: "FARMHOUSE" },
                { id: "209", label: "Куќа за повеќе семејства", value: "MULTI_FAMILY_HOUSE" },
                { id: "210", label: "Дел од куќа", value: "HOUSE_SECTION" },
                { id: "211", label: "Спрат од куќа", value: "HOUSE_FLOOR" },
            ],
        },
        {
            id: "3",
            value: PropertyType.holiday_home,
            label: "Викендичка",
            pluralLabel: "Викендички",
            url: `${ROUTE_URL.SEARCH_PROPERTIES_FOR_SALE}/vikendici`,
            queryParams: {
                listingType: PropertyListingType.for_sale,
                category: "3",
            },
            subcategories: [
                { id: "301", label: "Викендичка на плажа", value: "BEACH_HOUSE" },
                { id: "302", label: "Викендичка на планина", value: "MOUNTAIN_CABIN" },
                { id: "303", label: "Викендичка на село", value: "COUNTRY_COTTAGE" },
                { id: "304", label: "Викендичка на езеро", value: "LAKE_HOUSE" },
            ],
        },
        {
            id: "4",
            value: PropertyType.land,
            label: "Земјиште",
            pluralLabel: "Земјишта",
            url: `${ROUTE_URL.SEARCH_PROPERTIES_FOR_SALE}/zemjista`,
            queryParams: {
                listingType: PropertyListingType.for_sale,
                category: "4",
            },
            subcategories: [
                { id: "401", label: "Станбена парцела", value: "RESIDENTIAL_PLOT" },
                { id: "402", label: "Земјоделско земјиште", value: "AGRICULTURAL_LAND" },
                { id: "403", label: "Комерцијална парцела", value: "COMMERCIAL_PLOT" },
                { id: "404", label: "Индустриска парцела", value: "INDUSTRIAL_PLOT" },
                { id: "405", label: "Шумско земјиште", value: "FOREST_LAND" },
                { id: "406", label: "Рекреативна парцела", value: "RECREATIONAL_PLOT" },
            ],
        },
        {
            id: "5",
            value: PropertyType.garage,
            label: "Гаража",
            pluralLabel: "Гаражи",
            url: `${ROUTE_URL.SEARCH_PROPERTIES_FOR_SALE}/garazi`,
            queryParams: {
                listingType: PropertyListingType.for_sale,
                category: "5",
            },
            subcategories: [
                { id: "501", label: "Единечна гаража", value: "SINGLE_GARAGE" },
                { id: "502", label: "Двојна гаража", value: "DOUBLE_GARAGE" },
                { id: "503", label: "Подземно паркинг место", value: "UNDERGROUND_PARKING" },
                { id: "504", label: "Паркинг на отворено", value: "CARPORT" },
                { id: "505", label: "Гаражен блок", value: "GARAGE_UNIT" },
                { id: "506", label: "Гаража за повеќе возила", value: "MULTI_CAR_GARAGE" },
            ],
        },
        {
            id: "6",
            value: PropertyType.commercial,
            label: "Деловен простор",
            pluralLabel: "Деловни простории",
            url: `${ROUTE_URL.SEARCH_PROPERTIES_FOR_SALE}/prostori`,
            queryParams: {
                listingType: PropertyListingType.for_sale,
                category: "6",
            },
            subcategories: [
                { id: "601", label: "Канцеларија", value: "OFFICE" },
                { id: "602", label: "Продавница", value: "RETAIL" },
                { id: "608", label: "Локал", value: "RETAIL_SHOP" },
                { id: "603", label: "Индустриски простор", value: "INDUSTRIAL" },
                { id: "604", label: "Стовариште/Магацин", value: "WAREHOUSE" },
                { id: "605", label: "Ресторан/Хотел/Бар", value: "HOSPITALITY" },
                { id: "606", label: "Ко-работен простор", value: "COWORKING_SPACE" },
                { id: "607", label: "Изложбен простор", value: "SHOWROOM" },
            ],
        },
    ],
    sq: [
        {
            id: "1",
            value: PropertyType.flat,
            label: "Apartament",
            pluralLabel: "Apartamente",
            url: `${ROUTE_URL.SEARCH_PROPERTIES_FOR_SALE}/stanovi`,
            queryParams: {
                listingType: PropertyListingType.for_sale,
                category: "1",
            },
            subcategories: [
                { id: "101", label: "Garsonierë", value: "STUDIO" },
                { id: "102", label: "Apartament", value: "APARTMENT" },
                { id: "103", label: "Penthouse", value: "PENTHOUSE" },
                { id: "104", label: "Duplex", value: "DUPLEX" },
                { id: "108", label: "Kondominium", value: "CONDO" },
                { id: "109", label: "Apartament me kopsht", value: "GARDEN_APARTMENT" },
                { id: "110", label: "Apartament luksoz", value: "LUXURY_APARTMENT" },
                { id: "111", label: "Pjesë e shtëpisë", value: "FLAT_SECTION" },
                { id: "112", label: "Kat i shtëpisë", value: "FLAT_FLOOR" },
                { id: "113", label: "Apartament me galeri", value: "FLAT_GALLERY" },
            ],
        },
        {
            id: "2",
            value: PropertyType.house,
            label: "Shtëpi",
            pluralLabel: "Shtëpi",
            url: `${ROUTE_URL.SEARCH_PROPERTIES_FOR_SALE}/kuki`,
            queryParams: {
                listingType: PropertyListingType.for_sale,
                category: "2",
            },
            subcategories: [
                { id: "201", label: "Shtëpi e pavarur", value: "DETACHED" },
                { id: "202", label: "Shtëpi gjysmë e pavarur", value: "SEMI_DETACHED" },
                { id: "203", label: "Vilë", value: "VILLA" },
                { id: "204", label: "Bungalo", value: "BUNGALOW" },
                { id: "205", label: "Barakë", value: "BARRACKS" },
                { id: "206", label: "Kasolle", value: "COTTAGE" },
                { id: "207", label: "Shtëpi e qytetit", value: "TOWNHOUSE" },
                { id: "208", label: "Shtëpi fermë", value: "FARMHOUSE" },
                { id: "209", label: "Shtëpi për shumë familje", value: "MULTI_FAMILY_HOUSE" },
                { id: "210", label: "Pjesë e shtëpisë", value: "HOUSE_SECTION" },
                { id: "211", label: "Kat i shtëpisë", value: "HOUSE_FLOOR" },
            ],
        },
        {
            id: "3",
            value: PropertyType.holiday_home,
            label: "Shtëpi Pushimi",
            pluralLabel: "Shtëpi Pushimi",
            url: `${ROUTE_URL.SEARCH_PROPERTIES_FOR_SALE}/vikendici`,
            queryParams: {
                listingType: PropertyListingType.for_sale,
                category: "3",
            },
            subcategories: [
                { id: "301", label: "Shtëpi plazhi", value: "BEACH_HOUSE" },
                { id: "302", label: "Kabina malore", value: "MOUNTAIN_CABIN" },
                { id: "303", label: "Shtëpi fshati", value: "COUNTRY_COTTAGE" },
                { id: "304", label: "Shtëpi pranë liqenit", value: "LAKE_HOUSE" },
            ],
        },
        {
            id: "4",
            value: PropertyType.land,
            label: "Tokë",
            pluralLabel: "Toka",
            url: `${ROUTE_URL.SEARCH_PROPERTIES_FOR_SALE}/zemjista`,
            queryParams: {
                listingType: PropertyListingType.for_sale,
                category: "4",
            },
            subcategories: [
                { id: "401", label: "Parcelë banimi", value: "RESIDENTIAL_PLOT" },
                { id: "402", label: "Tokë bujqësore", value: "AGRICULTURAL_LAND" },
                { id: "403", label: "Parcelë komerciale", value: "COMMERCIAL_PLOT" },
                { id: "404", label: "Parcelë industriale", value: "INDUSTRIAL_PLOT" },
                { id: "405", label: "Tokë pyjore", value: "FOREST_LAND" },
                { id: "406", label: "Parcelë rekreative", value: "RECREATIONAL_PLOT" },
            ],
        },
        {
            id: "5",
            value: PropertyType.garage,
            label: "Garazh",
            pluralLabel: "Garazhe",
            url: `${ROUTE_URL.SEARCH_PROPERTIES_FOR_SALE}/garazi`,
            queryParams: {
                listingType: PropertyListingType.for_sale,
                category: "5",
            },
            subcategories: [
                { id: "501", label: "Garazh i vetëm", value: "SINGLE_GARAGE" },
                { id: "502", label: "Garazh i dyfishtë", value: "DOUBLE_GARAGE" },
                { id: "503", label: "Parkim nën tokë", value: "UNDERGROUND_PARKING" },
                { id: "504", label: "Strehë makinash", value: "CARPORT" },
                { id: "505", label: "Njësi garazhi", value: "GARAGE_UNIT" },
                { id: "506", label: "Garazh për shumë makina", value: "MULTI_CAR_GARAGE" },
            ],
        },
        {
            id: "6",
            value: PropertyType.commercial,
            label: "Komerciale",
            pluralLabel: "Prona Komerciale",
            url: `${ROUTE_URL.SEARCH_PROPERTIES_FOR_SALE}/prostori`,
            queryParams: {
                listingType: PropertyListingType.for_sale,
                category: "6",
            },
            subcategories: [
                { id: "601", label: "Zyrë", value: "OFFICE" },
                { id: "602", label: "Dyqan", value: "RETAIL" },
                { id: "608", label: "Локал", value: "RETAIL_SHOP" },
                { id: "603", label: "Industriale", value: "INDUSTRIAL" },
                { id: "604", label: "Magazinë/Depo", value: "WAREHOUSE" },
                { id: "605", label: "Restorant/Hotel/Bar", value: "HOSPITALITY" },
                { id: "606", label: "Hapësirë bashkëpunimi", value: "COWORKING_SPACE" },
                { id: "607", label: "Showroom", value: "SHOWROOM" },
            ],
        },
    ],
}

PropertyTypeDictionary.tr = [
    {
        id: "1",
        value: PropertyType.flat,
        label: "Daire",
        pluralLabel: "Daireler",
        url: `${ROUTE_URL.SEARCH_PROPERTIES_FOR_SALE}/stanovi`,
        queryParams: {
            listingType: PropertyListingType.for_sale,
            category: "1",
        },
        subcategories: [
            { id: "101", label: "Stüdyo", value: "STUDIO" },
            { id: "102", label: "Apartman dairesi", value: "APARTMENT" },
            { id: "103", label: "Penthouse", value: "PENTHOUSE" },
            { id: "104", label: "Dubleks", value: "DUPLEX" },
            { id: "108", label: "Site dairesi", value: "CONDO" },
            { id: "109", label: "Bahçeli daire", value: "GARDEN_APARTMENT" },
            { id: "110", label: "Lüks daire", value: "LUXURY_APARTMENT" },
            { id: "111", label: "Ev bölümü", value: "FLAT_SECTION" },
            { id: "112", label: "Ev katı", value: "FLAT_FLOOR" },
            { id: "113", label: "Galerili daire", value: "FLAT_GALLERY" },
        ],
    },
    {
        id: "2",
        value: PropertyType.house,
        label: "Ev",
        pluralLabel: "Evler",
        url: `${ROUTE_URL.SEARCH_PROPERTIES_FOR_SALE}/kuki`,
        queryParams: {
            listingType: PropertyListingType.for_sale,
            category: "2",
        },
        subcategories: [
            { id: "201", label: "Müstakil ev", value: "DETACHED" },
            { id: "202", label: "İkiz ev", value: "SEMI_DETACHED" },
            { id: "203", label: "Villa", value: "VILLA" },
            { id: "204", label: "Bungalov", value: "BUNGALOW" },
            { id: "205", label: "Prefabrik ev", value: "BARRACKS" },
            { id: "206", label: "Kır evi", value: "COTTAGE" },
            { id: "207", label: "Sıra ev", value: "TOWNHOUSE" },
            { id: "208", label: "Çiftlik evi", value: "FARMHOUSE" },
            { id: "209", label: "Çok aileli ev", value: "MULTI_FAMILY_HOUSE" },
            { id: "210", label: "Ev bölümü", value: "HOUSE_SECTION" },
            { id: "211", label: "Ev katı", value: "HOUSE_FLOOR" },
        ],
    },
    {
        id: "3",
        value: PropertyType.holiday_home,
        label: "Yazlık",
        pluralLabel: "Yazlıklar",
        url: `${ROUTE_URL.SEARCH_PROPERTIES_FOR_SALE}/vikendici`,
        queryParams: {
            listingType: PropertyListingType.for_sale,
            category: "3",
        },
        subcategories: [
            { id: "301", label: "Sahil evi", value: "BEACH_HOUSE" },
            { id: "302", label: "Dağ evi", value: "MOUNTAIN_CABIN" },
            { id: "303", label: "Köy evi", value: "COUNTRY_COTTAGE" },
            { id: "304", label: "Göl evi", value: "LAKE_HOUSE" },
        ],
    },
    {
        id: "4",
        value: PropertyType.land,
        label: "Arsa",
        pluralLabel: "Arsalar",
        url: `${ROUTE_URL.SEARCH_PROPERTIES_FOR_SALE}/zemjista`,
        queryParams: {
            listingType: PropertyListingType.for_sale,
            category: "4",
        },
        subcategories: [
            { id: "401", label: "Konut arsası", value: "RESIDENTIAL_PLOT" },
            { id: "402", label: "Tarım arazisi", value: "AGRICULTURAL_LAND" },
            { id: "403", label: "Ticari arsa", value: "COMMERCIAL_PLOT" },
            { id: "404", label: "Sanayi arsası", value: "INDUSTRIAL_PLOT" },
            { id: "405", label: "Orman arazisi", value: "FOREST_LAND" },
            { id: "406", label: "Rekreasyon arsası", value: "RECREATIONAL_PLOT" },
        ],
    },
    {
        id: "5",
        value: PropertyType.garage,
        label: "Garaj",
        pluralLabel: "Garajlar",
        url: `${ROUTE_URL.SEARCH_PROPERTIES_FOR_SALE}/garazi`,
        queryParams: {
            listingType: PropertyListingType.for_sale,
            category: "5",
        },
        subcategories: [
            { id: "501", label: "Tek araçlık garaj", value: "SINGLE_GARAGE" },
            { id: "502", label: "Çift araçlık garaj", value: "DOUBLE_GARAGE" },
            { id: "503", label: "Kapalı otopark", value: "UNDERGROUND_PARKING" },
            { id: "504", label: "Araç sundurması", value: "CARPORT" },
            { id: "505", label: "Garaj birimi", value: "GARAGE_UNIT" },
            { id: "506", label: "Çok araçlık garaj", value: "MULTI_CAR_GARAGE" },
        ],
    },
    {
        id: "6",
        value: PropertyType.commercial,
        label: "Ticari mülk",
        pluralLabel: "Ticari mülkler",
        url: `${ROUTE_URL.SEARCH_PROPERTIES_FOR_SALE}/prostori`,
        queryParams: {
            listingType: PropertyListingType.for_sale,
            category: "6",
        },
        subcategories: [
            { id: "601", label: "Ofis", value: "OFFICE" },
            { id: "602", label: "Mağaza", value: "RETAIL" },
            { id: "608", label: "Dükkan", value: "RETAIL_SHOP" },
            { id: "603", label: "Sanayi alanı", value: "INDUSTRIAL" },
            { id: "604", label: "Depo", value: "WAREHOUSE" },
            { id: "605", label: "Restoran/Otel/Bar", value: "HOSPITALITY" },
            { id: "606", label: "Ortak çalışma alanı", value: "COWORKING_SPACE" },
            { id: "607", label: "Showroom", value: "SHOWROOM" },
        ],
    },
]
