// COPIED FROM imotko/src/lib/dates/time_zone.js by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).

const SKOPJE_TIME_ZONE = "Europe/Skopje"

const getTimeZoneParts = (date, timeZone) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
    }).formatToParts(new Date(date))

    const value = type => Number(parts.find(part => part.type === type)?.value)

    return {
        year: value("year"),
        month: value("month"),
        day: value("day"),
        hour: value("hour"),
        minute: value("minute"),
        second: value("second"),
    }
}

const getDateKeyInTimeZone = (date, timeZone) =>
    new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date(date))

const getHourInTimeZone = (date, timeZone) => getTimeZoneParts(date, timeZone).hour

const getTimeZoneOffsetMs = (date, timeZone) => {
    const parts = getTimeZoneParts(date, timeZone)
    const wallClockAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
    const utcWithoutMs = Math.floor(new Date(date).getTime() / 1000) * 1000

    return wallClockAsUtc - utcWithoutMs
}

// Returns the UTC instant of 00:00 on the given calendar day in the time zone.
const getStartOfDayInTimeZone = ({ year, month, day }, timeZone) => {
    const midnightAsUtc = Date.UTC(year, month - 1, day)
    const firstGuess = midnightAsUtc - getTimeZoneOffsetMs(midnightAsUtc, timeZone)

    return new Date(midnightAsUtc - getTimeZoneOffsetMs(firstGuess, timeZone))
}

export { SKOPJE_TIME_ZONE, getDateKeyInTimeZone, getHourInTimeZone, getStartOfDayInTimeZone, getTimeZoneParts }
