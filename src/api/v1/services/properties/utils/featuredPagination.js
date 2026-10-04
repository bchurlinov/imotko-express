export const FEATURED_PER_PAGE = 3
export const FEATURED_ROTATION_MS = 60 * 60 * 1000

/**
 * Shuffle an array deterministically so pagination stays stable within a rotation window.
 * @template T
 * @param {T[]} items
 * @param {number} seed
 * @returns {T[]}
 */
export const seededShuffle = (items, seed) => {
    const shuffled = [...items]
    let state = seed >>> 0

    const random = () => {
        state = (state + 0x6d2b79f5) >>> 0
        let value = state
        value = Math.imul(value ^ (value >>> 15), value | 1)
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296
    }

    for (let index = shuffled.length - 1; index > 0; index--) {
        const randomIndex = Math.floor(random() * (index + 1))
        ;[shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]]
    }

    return shuffled
}

/**
 * Pick the promoted properties for a page without reshuffling between requests.
 * @template T
 * @param {T[]} ids
 * @param {number} page
 * @param {number} nowMs
 * @param {number} [slots]
 * @returns {T[]}
 */
export const featuredIdsForPage = (ids, page, nowMs, slots = FEATURED_PER_PAGE) => {
    const shuffledIds = seededShuffle(ids, Math.floor(nowMs / FEATURED_ROTATION_MS))
    if (shuffledIds.length <= slots) return shuffledIds

    const start = ((page - 1) * slots) % shuffledIds.length
    return Array.from({ length: slots }, (_, index) => shuffledIds[(start + index) % shuffledIds.length])
}

/**
 * @param {Date} now
 * @returns {import('#generated/prisma/client.ts').Prisma.PropertyWhereInput}
 */
export const activeFeaturedCondition = now => ({
    featured: true,
    OR: [{ featuredUntil: null }, { featuredUntil: { gt: now } }],
})

/**
 * @param {Date} now
 * @returns {import('#generated/prisma/client.ts').Prisma.PropertyWhereInput}
 */
export const inactiveFeaturedCondition = now => ({
    OR: [{ featured: false }, { featuredUntil: { lte: now } }],
})
