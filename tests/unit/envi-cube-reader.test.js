import { describe, expect, it, vi } from 'vitest';

import {
    calculateBsqTileSliceRange,
    calculateSampledBandStats,
} from '../../src/formats/envi-cube-reader.js';

function createHeader(overrides = {}) {
    return {
        samples: 2,
        lines: 2,
        bands: 1,
        interleave: 'bsq',
        dataType: 'u16',
        byteOrder: 'lsb',
        headerOffset: 0,
        bytesPerPixel: 2,
        ...overrides,
    };
}

describe('ENVI cube reader', () => {
    it('returns null stats when all collected chunks fail statistics calculation', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        const header = createHeader();
        const stats = await calculateSampledBandStats({
            enviReader: {
                extractBsqTileRaw: () => new Float32Array([1, 2, 3, 4]),
            },
            dataSource: {
                read: vi.fn(async () => new Uint8Array([1, 2, 3, 4]).buffer),
            },
            header,
            bands: [1],
            sampleTiles: [{ x: 0, y: 0 }],
            calculateStatistics: () => {
                throw new Error('statistics failed');
            },
            tileSize: 2,
        });

        expect(stats).toEqual({ 1: null });
        expect(consoleError).toHaveBeenCalled();
        consoleError.mockRestore();
    });

    it('preserves byte ranges above the 32-bit offset boundary', () => {
        const range = calculateBsqTileSliceRange(createHeader({
            headerOffset: 2 ** 32 + 128,
        }), 0, 0, 2);

        expect(range).toEqual({
            start: 2 ** 32 + 128,
            end: 2 ** 32 + 136,
        });
    });
});
