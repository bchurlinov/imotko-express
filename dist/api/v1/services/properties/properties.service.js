import prisma from "@/database/client.js";
import { PropertyStatus } from "@/generated/prisma/index.js";
const PAGE_SIZE = 15;
const DEFAULT_LOCALE = "mk";
const PROPERTY_SORTS = ["priceAsc", "priceDesc", "dateAsc", "dateDesc"];
const ORDER_BY_MAP = {
    priceAsc: [{ price: "asc" }],
    priceDesc: [{ price: "desc" }],
    dateAsc: [{ createdAt: "asc" }],
    dateDesc: [{ createdAt: "desc" }],
};
const DEFAULT_ORDER_BY = [
    { bumpedAt: { sort: "desc", nulls: "last" } },
    { createdAt: "desc" },
    { updatedAt: "desc" },
];
const propertySelect = {
    id: true,
    // name: true,
    // type: true,
    // price: true,
    // size: true,
    // latitude: true,
    // longitude: true,
    // listingType: true,
    // categoryId: true,
    // photos: true,
    // estimationPrice: true,
    // propertyLocation: true,
    // attributes: true,
    // slug: true,
    // updatedAt: true,
    // featured: true,
    // agency: {
    //     select: {
    //         imotkoApproved: true,
    //         name: true,
    //         logo: true,
    //     },
    // },
    propertyLocation: true
};
export const getProperties = async (params = {}) => {
    try {
        const locale = stringValue(params.locale) ?? DEFAULT_LOCALE;
        const filters = {
            status: PropertyStatus.PUBLISHED,
        };
        const andConditions = [];
        const orGroups = [];
        if (params.agency)
            filters.agencyId = stringValue(params.agency);
        const inDevelopment = booleanValue(params.in_development);
        if (typeof inDevelopment === "boolean")
            filters.inDevelopment = inDevelopment;
        if (params.location) {
            const locationIds = await resolveLocationIds(params.location);
            if (locationIds.length) {
                filters.propertyLocationId = { in: locationIds };
            }
            else {
                const fallbackLocation = stringValue(params.location);
                if (fallbackLocation)
                    filters.propertyLocationId = fallbackLocation;
            }
        }
        if (params.subCategory)
            filters.subcategoryId = stringValue(params.subCategory);
        if (params.category)
            filters.categoryId = stringValue(params.category);
        const listingType = stringValue(params.listingType);
        if (listingType)
            filters.listingType = listingType;
        const sizeFilter = buildNumericFilter(params.size_from ?? params.size, params.size_to) ??
            buildNumericFilter(params.size, undefined);
        if (sizeFilter)
            filters.size = sizeFilter;
        const withPriceOnly = booleanValue(params.with_price) ?? false;
        const priceRangeProvided = params.price_from !== undefined || params.price_to !== undefined;
        if (withPriceOnly) {
            filters.price = buildPriceFilter(params.price_from, params.price_to, true);
        }
        else if (priceRangeProvided) {
            const priceFilter = buildPriceFilter(params.price_from, params.price_to, true);
            if (priceFilter)
                orGroups.push([{ price: { equals: 0 } }, { price: priceFilter }]);
        }
        const bedroomFilter = buildAttributeFilter("numOfRooms", params.numOfBedroomsFrom, params.numOfBedroomsTo);
        if (bedroomFilter)
            andConditions.push(bedroomFilter);
        const bathroomFilter = buildAttributeFilter("numOfBathrooms", params.numOfBathroomsFrom, params.numOfBathroomsTo);
        if (bathroomFilter)
            andConditions.push(bathroomFilter);
        const sortParam = stringValue(params.sortBy);
        const orderBy = sortParam && isPropertySort(sortParam) ? ORDER_BY_MAP[sortParam] : DEFAULT_ORDER_BY;
        const searchQuery = stringValue(params.query);
        if (searchQuery) {
            const searchConditions = [
                {
                    name: {
                        path: [locale],
                        string_contains: searchQuery,
                        mode: "insensitive",
                    },
                },
                {
                    description: {
                        path: [locale],
                        string_contains: searchQuery,
                        mode: "insensitive",
                    },
                },
            ];
            orGroups.push(searchConditions);
        }
        if (orGroups.length === 1) {
            filters.OR = orGroups[0];
        }
        else if (orGroups.length > 1) {
            andConditions.push(...orGroups.map(group => ({ OR: group })));
        }
        if (andConditions.length) {
            filters.AND = andConditions;
        }
        const limit = positiveInt(params.limit) ?? PAGE_SIZE;
        const maxLimit = 500;
        const safeLimit = Math.min(limit, maxLimit);
        const total = await prisma.property.count({ where: filters });
        const totalPages = safeLimit > 0 ? Math.ceil(total / safeLimit) : 0;
        let page = positiveInt(params.page) ?? 1;
        page = Math.max(1, Math.min(page, totalPages || 1));
        const properties = await prisma.property.findMany({
            where: filters,
            orderBy,
            select: propertySelect,
            take: safeLimit,
            skip: (page - 1) * safeLimit,
        });
        return {
            data: properties,
            message: "Properties loaded successfully",
            pagination: {
                currentPage: page,
                pageSize: safeLimit,
                totalPages,
                total,
                hasMore: page < totalPages,
            },
        };
    }
    catch (error) {
        console.error("Error fetching properties:", error);
        throw new Error("Failed to fetch properties");
    }
};
const stringValue = (value) => {
    if (value === undefined || value === null)
        return undefined;
    if (Array.isArray(value))
        return stringValue(value[0]);
    if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed.length ? trimmed : undefined;
    }
    if (typeof value === "number" && Number.isFinite(value))
        return value.toString();
    if (typeof value === "boolean")
        return value.toString();
    return undefined;
};
const stringValues = (value) => {
    if (Array.isArray(value))
        return value.flatMap((entry) => stringValues(entry));
    const single = stringValue(value);
    if (!single)
        return [];
    return single
        .split(",")
        .map((token) => token.trim())
        .filter(Boolean);
};
const numberValue = (value) => {
    const raw = stringValue(value);
    if (!raw)
        return undefined;
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : undefined;
};
const booleanValue = (value) => {
    if (typeof value === "boolean")
        return value;
    const normalized = stringValue(value)?.toLowerCase();
    if (!normalized)
        return undefined;
    if (["true", "1", "yes"].includes(normalized))
        return true;
    if (["false", "0", "no"].includes(normalized))
        return false;
    return undefined;
};
const positiveInt = (value) => {
    const numeric = numberValue(value);
    if (numeric === undefined)
        return undefined;
    if (numeric <= 0)
        return undefined;
    return Math.floor(numeric);
};
const parseRangeValue = (value) => {
    const raw = stringValue(value);
    if (!raw)
        return undefined;
    const hasPlus = raw.endsWith("+");
    const numericPart = Number(hasPlus ? raw.slice(0, -1) : raw);
    if (!Number.isFinite(numericPart))
        return undefined;
    return {
        value: numericPart,
        hasPlus,
    };
};
const buildNumericFilter = (fromValue, toValue) => {
    const filter = {};
    const from = numberValue(fromValue);
    if (from !== undefined)
        filter.gte = from;
    const to = parseRangeValue(toValue);
    if (to) {
        if (to.hasPlus) {
            filter.gte = Math.max(filter.gte ?? to.value, to.value);
        }
        else {
            filter.lte = to.value;
        }
    }
    return Object.keys(filter).length ? filter : undefined;
};
const buildPriceFilter = (fromValue, toValue, enforcePositive = false) => {
    const filter = enforcePositive ? { gt: 0 } : {};
    const from = numberValue(fromValue);
    if (from !== undefined)
        filter.gte = Math.max(enforcePositive ? 1 : from, from);
    const to = parseRangeValue(toValue);
    if (to) {
        if (to.hasPlus) {
            const minPrice = from !== undefined ? Math.max(from, to.value) : to.value;
            filter.gte = Math.max(filter.gte ?? minPrice, minPrice);
        }
        else {
            filter.lte = to.value;
        }
    }
    return Object.keys(filter).length ? filter : undefined;
};
const buildAttributeFilter = (attributeKey, fromValue, toValue) => {
    const from = numberValue(fromValue);
    const to = parseRangeValue(toValue);
    if (from === undefined && !to)
        return undefined;
    const jsonFilter = {
        path: [attributeKey],
    };
    if (from !== undefined)
        jsonFilter.gte = from;
    if (to) {
        if (to.hasPlus) {
            jsonFilter.gte = Math.max(Number(jsonFilter.gte ?? to.value), to.value);
        }
        else {
            jsonFilter.lte = to.value;
        }
    }
    return {
        attributes: jsonFilter,
    };
};
const isPropertySort = (value) => PROPERTY_SORTS.includes(value);
const resolveLocationIds = async (locationParam) => {
    const requestedLocations = stringValues(locationParam);
    if (!requestedLocations.length)
        return [];
    const baseLocations = (await prisma.propertyLocation.findMany({
        where: {
            OR: [
                { id: { in: requestedLocations } },
                {
                    name: {
                        in: requestedLocations,
                        mode: "insensitive",
                    },
                },
            ],
        },
        select: { id: true },
    }));
    if (!baseLocations.length)
        return [];
    const discovered = new Set(baseLocations.map((location) => location.id));
    let frontier = [...discovered];
    while (frontier.length) {
        const children = (await prisma.propertyLocation.findMany({
            where: {
                parentId: { in: frontier },
            },
            select: { id: true },
        }));
        const newIds = children.map((child) => child.id).filter((id) => !discovered.has(id));
        if (!newIds.length)
            break;
        newIds.forEach((id) => discovered.add(id));
        frontier = newIds;
    }
    return Array.from(discovered);
};
