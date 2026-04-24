/**
 * @fileoverview Internal helpers for safe RGB band selection.
 */

export const DEFAULT_RGB_BANDS = Object.freeze({
    r: 30,
    g: 20,
    b: 10,
});

const CHANNELS = Object.freeze(['r', 'g', 'b']);

function normalizeBandCount(headerOrBandCount) {
    const bandCount = typeof headerOrBandCount === 'object'
        ? Number(headerOrBandCount?.bands)
        : Number(headerOrBandCount);

    if (!Number.isInteger(bandCount) || bandCount < 1) {
        throw new TypeError('A positive integer band count is required.');
    }

    return bandCount;
}

function normalizeBandValue(value, channel, bandCount) {
    const band = Number(value);

    if (!Number.isInteger(band)) {
        throw new TypeError(`Band "${channel}" must be an integer.`);
    }

    if (band < 1 || band > bandCount) {
        throw new RangeError(`Band "${channel}" must be between 1 and ${bandCount}.`);
    }

    return band;
}

export function normalizeViewerBands(bands, headerOrBandCount) {
    if (!bands || typeof bands !== 'object' || Array.isArray(bands)) {
        throw new TypeError('setBands(...) requires an object with r, g, and b bands.');
    }

    const bandCount = normalizeBandCount(headerOrBandCount);

    return Object.freeze({
        r: normalizeBandValue(bands.r, 'r', bandCount),
        g: normalizeBandValue(bands.g, 'g', bandCount),
        b: normalizeBandValue(bands.b, 'b', bandCount),
    });
}

export function createDefaultBandsForHeader(headerOrBandCount, preferredBands = DEFAULT_RGB_BANDS) {
    const bandCount = normalizeBandCount(headerOrBandCount);

    try {
        return normalizeViewerBands(preferredBands, bandCount);
    } catch {}

    if (bandCount === 1) {
        return Object.freeze({ r: 1, g: 1, b: 1 });
    }

    if (bandCount === 2) {
        return Object.freeze({ r: 2, g: 1, b: 1 });
    }

    return Object.freeze({
        r: bandCount,
        g: Math.max(1, Math.ceil(bandCount / 2)),
        b: 1,
    });
}

export function ensureBandsForHeader(bands, headerOrBandCount) {
    try {
        const normalizedBands = normalizeViewerBands(bands, headerOrBandCount);
        return Object.freeze({
            bands: normalizedBands,
            changed: CHANNELS.some((channel) => normalizedBands[channel] !== bands[channel]),
        });
    } catch {
        return Object.freeze({
            bands: createDefaultBandsForHeader(headerOrBandCount),
            changed: true,
        });
    }
}

export function uniqueBands(bands) {
    return Array.from(new Set(
        (Array.isArray(bands) ? bands : [])
            .map((band) => Number(band))
            .filter((band) => Number.isInteger(band) && band > 0)
    ));
}
