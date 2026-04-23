/**
 * @fileoverview Spatial-reference normalization and affine pixel/world mapping.
 */

function normalizeOptionalString(value) {
    return typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : undefined;
}

function normalizeFiniteNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : undefined;
}

function normalizeInteger(value) {
    const numeric = Number(value);
    return Number.isInteger(numeric) && numeric >= 0 ? numeric : undefined;
}

function normalizeCoordinatePair(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
    }

    const x = normalizeFiniteNumber(value.x);
    const y = normalizeFiniteNumber(value.y);

    if (x == null || y == null) {
        return undefined;
    }

    return Object.freeze({ x, y });
}

function normalizeAffineTransform(value) {
    if (!Array.isArray(value) || value.length !== 6) {
        return undefined;
    }

    const affineTransform = value.map((entry) => Number(entry));

    return affineTransform.every((entry) => Number.isFinite(entry))
        ? Object.freeze(affineTransform)
        : undefined;
}

function tokenizeMapInfo(value) {
    if (typeof value === 'string') {
        return value
            .split(',')
            .map((token) => token.trim())
            .filter((token) => token.length > 0);
    }

    if (Array.isArray(value)) {
        return value
            .map((token) => String(token).trim())
            .filter((token) => token.length > 0);
    }

    return undefined;
}

function normalizeHemisphere(value) {
    const normalized = normalizeOptionalString(value)?.toLowerCase();

    if (normalized === 'north') {
        return 'North';
    }

    if (normalized === 'south') {
        return 'South';
    }

    return undefined;
}

function extractUnits(tokens = []) {
    for (const token of tokens) {
        const match = /^units\s*=\s*(.+)$/i.exec(token);
        if (match?.[1]) {
            return match[1].trim();
        }
    }

    return undefined;
}

function createMapInfoFromTokens(tokens) {
    if (!Array.isArray(tokens) || tokens.length < 7) {
        return undefined;
    }

    const [
        projectionNameRaw,
        referencePixelXRaw,
        referencePixelYRaw,
        referenceCoordinateXRaw,
        referenceCoordinateYRaw,
        pixelSizeXRaw,
        pixelSizeYRaw,
        zoneRaw,
        hemisphereRaw,
        datumRaw,
        ...rest
    ] = tokens;

    const referencePixel = normalizeCoordinatePair({
        x: referencePixelXRaw,
        y: referencePixelYRaw,
    });
    const referenceCoordinate = normalizeCoordinatePair({
        x: referenceCoordinateXRaw,
        y: referenceCoordinateYRaw,
    });
    const pixelSize = normalizeCoordinatePair({
        x: pixelSizeXRaw,
        y: pixelSizeYRaw,
    });

    if (!referencePixel || !referenceCoordinate || !pixelSize) {
        return undefined;
    }

    const zone = normalizeInteger(zoneRaw);
    const hemisphere = normalizeHemisphere(hemisphereRaw);
    const datum = normalizeOptionalString(datumRaw);
    const units = extractUnits([zoneRaw, hemisphereRaw, datumRaw, ...rest]);

    return Object.freeze({
        projectionName: normalizeOptionalString(projectionNameRaw),
        referencePixel,
        referenceCoordinate,
        pixelSize,
        zone,
        hemisphere,
        datum,
        units,
        rawTokens: Object.freeze([...tokens]),
    });
}

function normalizeMapInfoObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
    }

    const tokenDerived = tokenizeMapInfo(value.rawTokens);
    const derivedFromTokens = tokenDerived ? createMapInfoFromTokens(tokenDerived) : undefined;
    const referencePixel = normalizeCoordinatePair(value.referencePixel) ?? derivedFromTokens?.referencePixel;
    const referenceCoordinate = normalizeCoordinatePair(value.referenceCoordinate) ?? derivedFromTokens?.referenceCoordinate;
    const pixelSize = normalizeCoordinatePair(value.pixelSize) ?? derivedFromTokens?.pixelSize;

    if (!referencePixel || !referenceCoordinate || !pixelSize) {
        return undefined;
    }

    const rawTokens = tokenDerived
        ? Object.freeze([...tokenDerived])
        : derivedFromTokens?.rawTokens ?? undefined;

    return Object.freeze({
        projectionName: normalizeOptionalString(value.projectionName) ?? derivedFromTokens?.projectionName,
        referencePixel,
        referenceCoordinate,
        pixelSize,
        zone: normalizeInteger(value.zone) ?? derivedFromTokens?.zone,
        hemisphere: normalizeHemisphere(value.hemisphere) ?? derivedFromTokens?.hemisphere,
        datum: normalizeOptionalString(value.datum) ?? derivedFromTokens?.datum,
        units: normalizeOptionalString(value.units) ?? derivedFromTokens?.units,
        rawTokens,
    });
}

function normalizeMapInfo(value) {
    if (value == null) {
        return undefined;
    }

    const tokens = tokenizeMapInfo(value);
    if (tokens) {
        return createMapInfoFromTokens(tokens);
    }

    return normalizeMapInfoObject(value);
}

function createAffineTransformFromMapInfo(mapInfo) {
    if (!mapInfo) {
        return undefined;
    }

    const {
        referencePixel,
        referenceCoordinate,
        pixelSize,
    } = mapInfo;

    if (!referencePixel || !referenceCoordinate || !pixelSize) {
        return undefined;
    }

    const affineTransform = [
        referenceCoordinate.x + (1 - referencePixel.x) * pixelSize.x,
        pixelSize.x,
        0,
        referenceCoordinate.y + (referencePixel.y - 1) * pixelSize.y,
        0,
        -pixelSize.y,
    ];

    return Object.freeze(affineTransform);
}

function resolveSpatialReference(value) {
    if (!value || typeof value !== 'object') {
        return undefined;
    }

    return value.spatialReference && typeof value.spatialReference === 'object'
        ? value.spatialReference
        : value;
}

export function normalizeSpatialReference(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
    }

    const mapInfo = normalizeMapInfo(value.mapInfo);
    const affineTransform = normalizeAffineTransform(value.affineTransform)
        ?? createAffineTransformFromMapInfo(mapInfo);
    const epsg = value.epsg == null ? undefined : normalizeInteger(value.epsg);
    const coordinateSystemString = normalizeOptionalString(value.coordinateSystemString);

    if (!mapInfo && !affineTransform && epsg == null && !coordinateSystemString) {
        return undefined;
    }

    return Object.freeze({
        affineTransform,
        epsg,
        coordinateSystemString,
        mapInfo,
    });
}

export function pixelToWorld(value, x, y) {
    const spatialReference = resolveSpatialReference(value);
    const affineTransform = spatialReference?.affineTransform;
    const pixelX = Number(x);
    const pixelY = Number(y);

    if (!affineTransform || !Number.isFinite(pixelX) || !Number.isFinite(pixelY)) {
        return null;
    }

    const [a, b, c, d, e, f] = affineTransform;

    return Object.freeze({
        x: a + b * pixelX + c * pixelY,
        y: d + e * pixelX + f * pixelY,
    });
}

export function worldToPixel(value, x, y) {
    const spatialReference = resolveSpatialReference(value);
    const affineTransform = spatialReference?.affineTransform;
    const worldX = Number(x);
    const worldY = Number(y);

    if (!affineTransform || !Number.isFinite(worldX) || !Number.isFinite(worldY)) {
        return null;
    }

    const [a, b, c, d, e, f] = affineTransform;
    const determinant = b * f - c * e;

    if (!Number.isFinite(determinant) || Math.abs(determinant) < Number.EPSILON) {
        return null;
    }

    const translatedX = worldX - a;
    const translatedY = worldY - d;

    return Object.freeze({
        x: (f * translatedX - c * translatedY) / determinant,
        y: (-e * translatedX + b * translatedY) / determinant,
    });
}
