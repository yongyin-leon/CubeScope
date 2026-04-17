/**
 * @fileoverview Stable cube-header normalization for public metadata contracts.
 */

const INTERLEAVES = new Set(['bil', 'bip', 'bsq']);
const BAND_DISPLAY_ROLES = new Set(['red', 'green', 'blue', 'nir', 'gray', 'other']);
const DATA_TYPE_ALIASES = new Map([
    [1, 'u8'],
    [16, 'u8'],
    [2, 'i16'],
    [3, 'i32'],
    [4, 'f32'],
    [5, 'f64'],
    [6, 'complex-f32'],
    [9, 'complex-f64'],
    [12, 'u16'],
    [13, 'u32'],
    [14, 'i64'],
    [15, 'u64'],
    ['u8', 'u8'],
    ['uint8', 'u8'],
    ['byte', 'u8'],
    ['i16', 'i16'],
    ['int16', 'i16'],
    ['i32', 'i32'],
    ['int32', 'i32'],
    ['f32', 'f32'],
    ['float32', 'f32'],
    ['float', 'f32'],
    ['f64', 'f64'],
    ['float64', 'f64'],
    ['complexf32', 'complex-f32'],
    ['complex-f32', 'complex-f32'],
    ['cf32', 'complex-f32'],
    ['complexf64', 'complex-f64'],
    ['complex-f64', 'complex-f64'],
    ['cf64', 'complex-f64'],
    ['u16', 'u16'],
    ['uint16', 'u16'],
    ['u32', 'u32'],
    ['uint32', 'u32'],
    ['i64', 'i64'],
    ['int64', 'i64'],
    ['u64', 'u64'],
    ['uint64', 'u64'],
]);
const BYTE_ORDER_ALIASES = new Map([
    [0, 'lsb'],
    [1, 'msb'],
    ['0', 'lsb'],
    ['1', 'msb'],
    ['lsb', 'lsb'],
    ['little', 'lsb'],
    ['little-endian', 'lsb'],
    ['msb', 'msb'],
    ['big', 'msb'],
    ['big-endian', 'msb'],
]);

function normalizeIntegerField(fieldName, value, { allowZero = false } = {}) {
    const normalized = Number(value);

    if (!Number.isInteger(normalized) || normalized < 0 || (!allowZero && normalized === 0)) {
        throw new TypeError(`CubeHeader.${fieldName} must be a ${allowZero ? 'non-negative' : 'positive'} integer.`);
    }

    return normalized;
}

function normalizeOptionalString(value) {
    return typeof value === 'string' && value.length > 0
        ? value
        : undefined;
}

function normalizeInterleave(value) {
    const normalized = String(value ?? '').toLowerCase();

    if (!INTERLEAVES.has(normalized)) {
        throw new TypeError(`Unsupported CubeHeader.interleave value: ${value}`);
    }

    return normalized;
}

function normalizeDataType(value) {
    const key = typeof value === 'string'
        ? value.trim().toLowerCase()
        : Number(value);
    const normalized = DATA_TYPE_ALIASES.get(key);

    if (!normalized) {
        throw new TypeError(`Unsupported CubeHeader.dataType value: ${value}`);
    }

    return normalized;
}

function normalizeByteOrder(value) {
    const key = typeof value === 'string'
        ? value.trim().toLowerCase()
        : Number(value);
    const normalized = BYTE_ORDER_ALIASES.get(key);

    if (!normalized) {
        throw new TypeError(`Unsupported CubeHeader.byteOrder value: ${value}`);
    }

    return normalized;
}

function normalizeNumberArray(value) {
    if (!Array.isArray(value)) {
        return undefined;
    }

    return Object.freeze(value.map((entry) => {
        const numeric = Number(entry);

        if (!Number.isFinite(numeric)) {
            throw new TypeError('CubeHeader numeric arrays must contain finite numbers.');
        }

        return numeric;
    }));
}

function normalizeCustomFields(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
    }

    return Object.freeze(Object.fromEntries(
        Object.entries(value).map(([key, entryValue]) => [key, String(entryValue)])
    ));
}

function normalizeBandMetadata(value) {
    if (!Array.isArray(value)) {
        return undefined;
    }

    return Object.freeze(value.map((entry) => {
        const displayRole = typeof entry?.displayRole === 'string'
            ? entry.displayRole.toLowerCase()
            : undefined;

        return Object.freeze({
            index: normalizeIntegerField('bandMetadata.index', entry?.index),
            name: normalizeOptionalString(entry?.name),
            wavelength: entry?.wavelength == null ? undefined : Number(entry.wavelength),
            displayRole: BAND_DISPLAY_ROLES.has(displayRole) ? displayRole : undefined,
        });
    }));
}

function normalizeSpatialReference(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
    }

    const affineTransform = Array.isArray(value.affineTransform)
        && value.affineTransform.length === 6
        ? Object.freeze(value.affineTransform.map((entry) => Number(entry)))
        : undefined;
    const epsg = value.epsg == null
        ? undefined
        : normalizeIntegerField('spatialReference.epsg', value.epsg);
    const coordinateSystemString = normalizeOptionalString(value.coordinateSystemString);
    const mapInfo = value.mapInfo == null
        ? undefined
        : Array.isArray(value.mapInfo)
            ? Object.freeze([...value.mapInfo])
            : value.mapInfo;

    return Object.freeze({
        affineTransform,
        epsg,
        coordinateSystemString,
        mapInfo,
    });
}

export function normalizeCubeHeader(header) {
    if (!header || typeof header !== 'object') {
        throw new TypeError('normalizeCubeHeader(...) requires a header object.');
    }

    return Object.freeze({
        samples: normalizeIntegerField('samples', header.samples),
        lines: normalizeIntegerField('lines', header.lines),
        bands: normalizeIntegerField('bands', header.bands),
        interleave: normalizeInterleave(header.interleave),
        dataType: normalizeDataType(header.dataType),
        byteOrder: normalizeByteOrder(header.byteOrder),
        headerOffset: normalizeIntegerField('headerOffset', header.headerOffset, { allowZero: true }),
        bytesPerPixel: normalizeIntegerField('bytesPerPixel', header.bytesPerPixel),
        description: normalizeOptionalString(header.description),
        fileType: normalizeOptionalString(header.fileType),
        sensorType: normalizeOptionalString(header.sensorType),
        wavelength: normalizeNumberArray(header.wavelength),
        customFields: normalizeCustomFields(header.customFields),
        bandMetadata: normalizeBandMetadata(header.bandMetadata),
        spatialReference: normalizeSpatialReference(header.spatialReference),
    });
}

export function isCubeHeader(value) {
    try {
        normalizeCubeHeader(value);
        return true;
    } catch {
        return false;
    }
}
