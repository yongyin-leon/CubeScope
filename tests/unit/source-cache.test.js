import { describe, expect, it } from 'vitest';

import {
    CacheInvalidation,
    CacheOwner,
    DEFAULT_METADATA_CACHE_POLICY,
    DEFAULT_RAW_TILE_CACHE_POLICY,
    DEFAULT_RENDER_TILE_CACHE_POLICY,
    DEFAULT_STATS_CACHE_POLICY,
    SourceMapCache,
    SourceValueCache,
} from '../../src/runtime/source-cache.js';

describe('source-scoped cache ownership', () => {
    it('freezes explicit cache policies for metadata, stats, raw tiles, and render tiles', () => {
        expect(DEFAULT_METADATA_CACHE_POLICY).toEqual({
            owner: CacheOwner.METADATA,
            scope: 'source',
            entryBudget: 1,
            invalidation: [
                CacheInvalidation.UNLOAD,
                CacheInvalidation.SOURCE_SWITCH,
                CacheInvalidation.DESTROY,
            ],
        });

        expect(DEFAULT_STATS_CACHE_POLICY.owner).toBe(CacheOwner.STATS);
        expect(DEFAULT_RAW_TILE_CACHE_POLICY.byteBudget).toBe(64 * 1024 * 1024);
        expect(DEFAULT_RENDER_TILE_CACHE_POLICY).toEqual({
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
    });

    it('keeps metadata source-scoped and clears it on invalidation', () => {
        const cache = new SourceValueCache();

        cache.set(7, { fileName: 'cube-a.img' });
        cache.set(8, { fileName: 'cube-b.img' });

        expect(cache.get(7)).toEqual({ fileName: 'cube-a.img' });
        expect(cache.get(8)).toEqual({ fileName: 'cube-b.img' });

        expect(cache.clearSource(7)).toBe(true);
        expect(cache.get(7)).toBeNull();
        expect(cache.get(8)).toEqual({ fileName: 'cube-b.img' });
    });

    it('keeps stats source-scoped and clears one source without touching another', () => {
        const cache = new SourceMapCache();

        cache.set(7, 10, { min: 0, max: 1 });
        cache.set(7, 20, { min: 2, max: 3 });
        cache.set(8, 10, { min: 4, max: 5 });

        expect(cache.has(7, 10)).toBe(true);
        expect(cache.keys(7)).toEqual([10, 20]);
        expect(cache.get(8, 10)).toEqual({ min: 4, max: 5 });

        expect(cache.clearSource(7)).toBe(true);
        expect(cache.keys(7)).toEqual([]);
        expect(cache.get(8, 10)).toEqual({ min: 4, max: 5 });
    });
});
