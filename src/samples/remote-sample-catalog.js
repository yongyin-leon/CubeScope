/**
 * @fileoverview Shared remote-sample catalog helpers for the demo and validation scripts.
 */

const SAMPLE_KINDS = new Set(['envi-http']);
const SAMPLE_AVAILABILITY = new Set(['deterministic-local', 'public']);
const SAMPLE_VALIDATION_TIERS = new Set(['local', 'public']);

function normalizeNonEmptyString(fieldName, value) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new TypeError(`Remote sample field "${fieldName}" must be a non-empty string.`);
    }

    return value.trim();
}

function normalizeOptionalString(value) {
    return typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : undefined;
}

function normalizeHeaders(value) {
    if (value == null) {
        return undefined;
    }

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new TypeError('Remote sample headers must be a plain object when provided.');
    }

    return Object.freeze(Object.fromEntries(
        Object.entries(value).map(([key, entryValue]) => [
            normalizeNonEmptyString('headers.key', key),
            String(entryValue),
        ])
    ));
}

export function normalizeRemoteSampleEntry(entry) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        throw new TypeError('Remote sample entries must be objects.');
    }

    const kind = normalizeNonEmptyString('kind', entry.kind);
    if (!SAMPLE_KINDS.has(kind)) {
        throw new TypeError(`Unsupported remote sample kind: ${entry.kind}`);
    }

    const availability = entry.availability == null
        ? 'deterministic-local'
        : normalizeNonEmptyString('availability', entry.availability);
    if (!SAMPLE_AVAILABILITY.has(availability)) {
        throw new TypeError(`Unsupported remote sample availability: ${entry.availability}`);
    }

    const validationTier = entry.validationTier == null
        ? 'local'
        : normalizeNonEmptyString('validationTier', entry.validationTier);
    if (!SAMPLE_VALIDATION_TIERS.has(validationTier)) {
        throw new TypeError(`Unsupported remote sample validationTier: ${entry.validationTier}`);
    }

    return Object.freeze({
        id: normalizeNonEmptyString('id', entry.id),
        title: normalizeNonEmptyString('title', entry.title),
        kind,
        availability,
        validationTier,
        description: normalizeOptionalString(entry.description),
        headerUrl: normalizeNonEmptyString('headerUrl', entry.headerUrl),
        dataUrl: normalizeNonEmptyString('dataUrl', entry.dataUrl),
        headers: normalizeHeaders(entry.headers),
        license: normalizeOptionalString(entry.license),
    });
}

export function normalizeRemoteSampleCatalog(catalog) {
    if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) {
        throw new TypeError('Remote sample catalog must be an object.');
    }

    if (!Array.isArray(catalog.samples)) {
        throw new TypeError('Remote sample catalog must include a "samples" array.');
    }

    const seenIds = new Set();
    const samples = Object.freeze(catalog.samples.map((entry) => {
        const sample = normalizeRemoteSampleEntry(entry);
        if (seenIds.has(sample.id)) {
            throw new TypeError(`Remote sample catalog contains a duplicate id: ${sample.id}`);
        }
        seenIds.add(sample.id);
        return sample;
    }));

    return Object.freeze({
        version: Number.isInteger(Number(catalog.version))
            ? Number(catalog.version)
            : 1,
        catalogId: normalizeOptionalString(catalog.catalogId),
        description: normalizeOptionalString(catalog.description),
        samples,
    });
}

export async function fetchRemoteSampleCatalog(url, options = {}) {
    const fetchImpl = options.fetchImpl ?? globalThis.fetch;

    if (typeof fetchImpl !== 'function') {
        throw new Error('fetchRemoteSampleCatalog(...) requires a fetch implementation.');
    }

    const response = await fetchImpl(url);
    if (!response.ok) {
        throw new Error(`Remote sample catalog fetch failed: ${response.status} ${response.statusText}`);
    }

    return normalizeRemoteSampleCatalog(await response.json());
}

export function getRemoteSampleById(catalog, sampleId) {
    const normalizedCatalog = normalizeRemoteSampleCatalog(catalog);
    return normalizedCatalog.samples.find((entry) => entry.id === sampleId) ?? null;
}

export function buildRemoteSampleLoadSource(sample) {
    const normalizedSample = normalizeRemoteSampleEntry(sample);

    return {
        kind: normalizedSample.kind,
        headerUrl: normalizedSample.headerUrl,
        dataUrl: normalizedSample.dataUrl,
        headers: normalizedSample.headers
            ? { ...normalizedSample.headers }
            : undefined,
    };
}

export function resolveRemoteSampleUrl(sample, fieldName, baseUrl) {
    const normalizedSample = normalizeRemoteSampleEntry(sample);
    const rawValue = normalizedSample[fieldName];

    if (typeof rawValue !== 'string') {
        throw new TypeError(`Remote sample field "${fieldName}" is not a URL-bearing string field.`);
    }

    return new URL(rawValue, baseUrl).toString();
}
