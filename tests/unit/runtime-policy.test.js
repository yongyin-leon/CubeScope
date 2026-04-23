import { describe, expect, it } from 'vitest';

import { ViewerRuntimePolicy } from '../../src/runtime/runtime-policy.js';

describe('ViewerRuntimePolicy', () => {
    it('resolves band stats plans into either missing bands or ready global stats', () => {
        const stats = new Map([
            [10, { min: 1, max: 2 }],
            [20, { min: 3, max: 4 }],
            [30, { min: 5, max: 6 }],
        ]);
        const policy = new ViewerRuntimePolicy();

        expect(policy.resolveBandStatsPlan({
            bands: [30, 20, 10],
            hasBandStats: (band) => stats.has(band),
            getBandStats: (band) => stats.get(band),
        })).toEqual({
            ready: true,
            missingBands: [],
            globalStats: {
                10: { min: 1, max: 2 },
                20: { min: 3, max: 4 },
                30: { min: 5, max: 6 },
            },
        });

        expect(policy.resolveBandStatsPlan({
            bands: [30, 20, 11],
            hasBandStats: (band) => stats.has(band),
            getBandStats: (band) => stats.get(band),
        })).toEqual({
            ready: false,
            missingBands: [11],
            globalStats: null,
        });
    });

    it('tracks initial-load completion and band-switch timing metrics', () => {
        let now = 100;
        const policy = new ViewerRuntimePolicy({
            now: () => now,
        });

        policy.beginLoad();
        policy.registerVisibleTiles([{ x: 0, y: 0 }, { x: 1, y: 0 }]);
        expect(policy.recordCompletedInitialTile('0,0')).toBeNull();

        now = 118;
        expect(policy.recordCompletedInitialTile('1,0')).toEqual({
            name: 'timeToInitialView',
            value: 18,
            unit: 'ms',
        });

        now = 200;
        policy.beginBandSwitch();
        now = 209;
        expect(policy.completeBandSwitchMetric()).toEqual({
            name: 'bandSwitchTime',
            value: 9,
            unit: 'ms',
        });
    });

    it('builds preload entries ordered by tile distance and excluding visible/active tiles', () => {
        const policy = new ViewerRuntimePolicy();
        const entries = policy.buildPreloadEntries({
            header: {
                samples: 1024,
                lines: 1024,
            },
            visibleTiles: [{ x: 0, y: 0 }],
            tileSize: 512,
            hasActiveTile: (tileKey) => tileKey === '1,1',
        });

        expect(entries).toEqual([
            { tile: { x: 1, y: 0 }, dist: 1 },
            { tile: { x: 0, y: 1 }, dist: 1 },
        ]);
    });
});
