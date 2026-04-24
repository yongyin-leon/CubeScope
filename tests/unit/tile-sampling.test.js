import { describe, expect, it } from 'vitest';

import {
    buildDeterministicSampleTiles,
    getTileGrid,
} from '../../src/runtime/tile-sampling.js';

describe('tile-sampling helpers', () => {
    it('derives tile grid dimensions with edge tiles included', () => {
        expect(getTileGrid({
            samples: 1025,
            lines: 1025,
        }, 512)).toEqual({
            columns: 3,
            rows: 3,
        });
    });

    it('samples deterministic corners and center tiles first', () => {
        expect(buildDeterministicSampleTiles({
            samples: 1025,
            lines: 1025,
        }, {
            tileSize: 512,
            sampleCount: 5,
        })).toEqual([
            { x: 0, y: 0 },
            { x: 2, y: 2 },
            { x: 1, y: 1 },
            { x: 2, y: 0 },
            { x: 0, y: 2 },
        ]);
    });

    it('returns the same samples across repeated calls', () => {
        const header = {
            samples: 4097,
            lines: 3073,
        };
        const options = {
            tileSize: 512,
            sampleCount: 5,
        };

        expect(buildDeterministicSampleTiles(header, options))
            .toEqual(buildDeterministicSampleTiles(header, options));
    });

    it('deduplicates samples for small fixtures', () => {
        expect(buildDeterministicSampleTiles({
            samples: 48,
            lines: 48,
        }, {
            tileSize: 512,
            sampleCount: 5,
        })).toEqual([
            { x: 0, y: 0 },
        ]);
    });
});
