/**
 * @fileoverview Source-scoped cache helpers and ownership policies.
 */

export const CacheOwner = Object.freeze({
    METADATA: 'viewer-runtime:metadata',
    STATS: 'viewer-runtime:stats',
    RAW_TILES: 'viewer-runtime:raw-tiles',
    RENDER_TILES: 'webgpu-renderer:render-tiles',
});

export const CacheInvalidation = Object.freeze({
    UNLOAD: 'unload',
    SOURCE_SWITCH: 'source-switch',
    DESTROY: 'destroy',
    VIEWPORT_EVICTION: 'viewport-eviction',
    BUDGET_EVICTION: 'budget-eviction',
    DEVICE_LOSS: 'device-loss',
});

function freezePolicy(policy) {
    return Object.freeze({
        ...policy,
        invalidation: Object.freeze([...(policy.invalidation ?? [])]),
    });
}

export const DEFAULT_METADATA_CACHE_POLICY = freezePolicy({
    owner: CacheOwner.METADATA,
    scope: 'source',
    entryBudget: 1,
    invalidation: [
        CacheInvalidation.UNLOAD,
        CacheInvalidation.SOURCE_SWITCH,
        CacheInvalidation.DESTROY,
    ],
});

export const DEFAULT_STATS_CACHE_POLICY = freezePolicy({
    owner: CacheOwner.STATS,
    scope: 'source',
    entryBudget: Number.MAX_SAFE_INTEGER,
    invalidation: [
        CacheInvalidation.UNLOAD,
        CacheInvalidation.SOURCE_SWITCH,
        CacheInvalidation.DESTROY,
    ],
});

export const DEFAULT_RAW_TILE_CACHE_POLICY = freezePolicy({
    owner: CacheOwner.RAW_TILES,
    scope: 'source+viewport',
    byteBudget: 64 * 1024 * 1024,
    invalidation: [
        CacheInvalidation.UNLOAD,
        CacheInvalidation.SOURCE_SWITCH,
        CacheInvalidation.VIEWPORT_EVICTION,
        CacheInvalidation.BUDGET_EVICTION,
    ],
});

export const DEFAULT_RENDER_TILE_CACHE_POLICY = freezePolicy({
    owner: CacheOwner.RENDER_TILES,
    scope: 'source+renderer-slot',
    byteBudget: 128 * 1024 * 1024,
    tileBudget: 512,
    invalidation: [
        CacheInvalidation.UNLOAD,
        CacheInvalidation.SOURCE_SWITCH,
        CacheInvalidation.BUDGET_EVICTION,
        CacheInvalidation.DEVICE_LOSS,
        CacheInvalidation.DESTROY,
    ],
});

export class SourceValueCache {
    #policy;
    #entries = new Map();

    constructor(policy = DEFAULT_METADATA_CACHE_POLICY) {
        this.#policy = policy;
    }

    getPolicy() {
        return this.#policy;
    }

    get(sourceId) {
        return this.#entries.get(sourceId) ?? null;
    }

    set(sourceId, value) {
        if (!(sourceId > 0)) {
            return;
        }

        this.#entries.set(sourceId, value);
    }

    clearSource(sourceId) {
        return this.#entries.delete(sourceId);
    }

    clear() {
        this.#entries.clear();
    }
}

export class SourceMapCache {
    #policy;
    #entries = new Map();

    constructor(policy = DEFAULT_STATS_CACHE_POLICY) {
        this.#policy = policy;
    }

    getPolicy() {
        return this.#policy;
    }

    #getSourceMap(sourceId, create = false) {
        let sourceMap = this.#entries.get(sourceId);

        if (!sourceMap && create) {
            sourceMap = new Map();
            this.#entries.set(sourceId, sourceMap);
        }

        return sourceMap ?? null;
    }

    has(sourceId, key) {
        return this.#getSourceMap(sourceId)?.has(key) === true;
    }

    get(sourceId, key) {
        return this.#getSourceMap(sourceId)?.get(key) ?? null;
    }

    set(sourceId, key, value) {
        if (!(sourceId > 0)) {
            return;
        }

        this.#getSourceMap(sourceId, true).set(key, value);
    }

    delete(sourceId, key) {
        const sourceMap = this.#getSourceMap(sourceId);

        if (!sourceMap?.delete(key)) {
            return false;
        }

        if (sourceMap.size === 0) {
            this.#entries.delete(sourceId);
        }

        return true;
    }

    clearSource(sourceId) {
        return this.#entries.delete(sourceId);
    }

    clear() {
        this.#entries.clear();
    }

    keys(sourceId) {
        return Array.from(this.#getSourceMap(sourceId)?.keys() ?? []);
    }
}
