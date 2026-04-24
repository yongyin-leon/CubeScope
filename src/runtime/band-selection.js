/**
 * @fileoverview Internal helpers for safe RGB band selection.
 */

export const DEFAULT_RGB_BANDS = Object.freeze({
    r: 30,
    g: 20,
    b: 10,
});

const CHANNELS = Object.freeze(['r', 'g', 'b']);
const VISIBLE_TARGET_WAVELENGTHS_NM = Object.freeze({
    r: 650,
    g: 550,
    b: 470,
});

function normalizeCustomFieldKey(key) {
    return String(key ?? '')
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ');
}

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

function getCustomField(header, fieldName) {
    const customFields = header?.customFields;
    if (!customFields || typeof customFields !== 'object' || Array.isArray(customFields)) {
        return undefined;
    }

    const normalizedFieldName = normalizeCustomFieldKey(fieldName);
    const entry = Object.entries(customFields)
        .find(([key]) => normalizeCustomFieldKey(key) === normalizedFieldName);

    return entry?.[1];
}

function parseBandList(value) {
    const source = Array.isArray(value)
        ? value
        : String(value ?? '')
            .replace(/[{}]/g, ' ')
            .split(/[,\s]+/);

    return source
        .map((entry) => String(entry).trim())
        .filter((entry) => entry.length > 0)
        .map((entry) => Number(String(entry).trim()))
        .filter((entry) => Number.isInteger(entry));
}

function selectDefaultBandsFromHeaderField(header) {
    const defaultBands = parseBandList(getCustomField(header, 'default bands'));
    if (defaultBands.length < CHANNELS.length) {
        return null;
    }

    try {
        return normalizeViewerBands({
            r: defaultBands[0],
            g: defaultBands[1],
            b: defaultBands[2],
        }, header);
    } catch {
        return null;
    }
}

function normalizeWavelengthUnitScale(header, wavelengths) {
    const units = String(getCustomField(header, 'wavelength units') ?? '')
        .trim()
        .toLowerCase();

    if (/\b(nm|nanometer|nanometers)\b/.test(units)) {
        return 1;
    }

    if (units.includes('µm') || /\b(um|micron|microns|micrometer|micrometers)\b/.test(units)) {
        return 0.001;
    }

    const maxWavelength = Math.max(...wavelengths);
    return maxWavelength < 100 ? 0.001 : 1;
}

function selectNearestDistinctBands(wavelengths, targets) {
    const selected = [];
    const used = new Set();

    for (const target of targets) {
        let best = null;
        for (const entry of wavelengths) {
            const duplicatePenalty = used.has(entry.band) ? Number.MAX_SAFE_INTEGER : 0;
            const score = Math.abs(entry.wavelength - target) + duplicatePenalty;
            if (!best || score < best.score || (score === best.score && entry.band < best.band)) {
                best = { ...entry, score };
            }
        }

        if (best) {
            selected.push(best.band);
            used.add(best.band);
        }
    }

    return selected.length === CHANNELS.length
        ? Object.freeze({ r: selected[0], g: selected[1], b: selected[2] })
        : null;
}

function selectDefaultBandsFromWavelengths(header) {
    const bandCount = normalizeBandCount(header);
    const wavelengths = Array.isArray(header?.wavelength)
        ? header.wavelength
            .slice(0, bandCount)
            .map((wavelength, index) => ({
                band: index + 1,
                wavelength: Number(wavelength),
            }))
            .filter((entry) => Number.isFinite(entry.wavelength))
        : [];

    if (wavelengths.length < CHANNELS.length) {
        return null;
    }

    const values = wavelengths.map((entry) => entry.wavelength);
    const scale = normalizeWavelengthUnitScale(header, values);
    const minWavelength = Math.min(...values);
    const maxWavelength = Math.max(...values);
    const hasVisibleRange = minWavelength <= 480 * scale && maxWavelength >= 650 * scale;
    const targets = hasVisibleRange
        ? [
            VISIBLE_TARGET_WAVELENGTHS_NM.r * scale,
            VISIBLE_TARGET_WAVELENGTHS_NM.g * scale,
            VISIBLE_TARGET_WAVELENGTHS_NM.b * scale,
        ]
        : [
            minWavelength + (maxWavelength - minWavelength) * 0.75,
            minWavelength + (maxWavelength - minWavelength) * 0.5,
            minWavelength + (maxWavelength - minWavelength) * 0.25,
        ];

    return selectNearestDistinctBands(wavelengths, targets);
}

export function selectDefaultBandsForHeader(headerOrBandCount, preferredBands = DEFAULT_RGB_BANDS) {
    if (typeof headerOrBandCount !== 'object' || headerOrBandCount === null) {
        return createDefaultBandsForHeader(headerOrBandCount, preferredBands);
    }

    return selectDefaultBandsFromHeaderField(headerOrBandCount)
        ?? selectDefaultBandsFromWavelengths(headerOrBandCount)
        ?? createDefaultBandsForHeader(headerOrBandCount, preferredBands);
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
